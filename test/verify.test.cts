import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

import { KirimiTrigger } from '../nodes/KirimiTrigger/KirimiTrigger.node';
import {
	SIGNATURE_TOLERANCE_SECONDS,
	bodyToText,
	computeSignature,
	verifySignature,
} from '../nodes/KirimiTrigger/verify';
import { createContext } from './helpers.cjs';

const SECRET = 'whsec_test';
const BODY = '{"event":"message","id":"evt-1"}';
const NOW = 1_800_000_000;

const signed = (timestamp: number, body = BODY, secret = SECRET) => {
	const ts = String(timestamp);
	return { ts, signature: computeSignature(secret, ts, body) };
};

describe('verifySignature', () => {
	it('matches the documented HMAC-SHA256 of "<timestamp>.<body>"', () => {
		const { ts, signature } = signed(NOW);
		assert.equal(signature, createHmac('sha256', SECRET).update(`${ts}.${BODY}`).digest('hex'));
	});

	it('accepts a valid signature, with or without the sha256= prefix and in any case', () => {
		const { ts, signature } = signed(NOW);
		for (const header of [signature, `sha256=${signature}`, signature.toUpperCase()]) {
			const result = verifySignature({
				secret: SECRET,
				signatureHeader: header,
				timestampHeader: ts,
				bodyText: BODY,
				nowSeconds: NOW,
			});
			assert.deepEqual(result, { ok: true });
		}
	});

	it('rejects a tampered body', () => {
		const { ts, signature } = signed(NOW);
		const result = verifySignature({
			secret: SECRET,
			signatureHeader: signature,
			timestampHeader: ts,
			bodyText: BODY.replace('message', 'qr'),
			nowSeconds: NOW,
		});
		assert.deepEqual(result, { ok: false, reason: 'signature_mismatch' });
	});

	it('rejects a wrong secret and a signature of the wrong length', () => {
		const { ts } = signed(NOW);
		const wrongSecret = computeSignature('other', ts, BODY);
		for (const header of [wrongSecret, 'abcd']) {
			const result = verifySignature({
				secret: SECRET,
				signatureHeader: header,
				timestampHeader: ts,
				bodyText: BODY,
				nowSeconds: NOW,
			});
			assert.deepEqual(result, { ok: false, reason: 'signature_mismatch' });
		}
	});

	it('enforces the timestamp tolerance in both directions', () => {
		const accepted = [NOW - SIGNATURE_TOLERANCE_SECONDS, NOW + SIGNATURE_TOLERANCE_SECONDS];
		for (const timestamp of accepted) {
			const { ts, signature } = signed(timestamp);
			assert.equal(
				verifySignature({
					secret: SECRET,
					signatureHeader: signature,
					timestampHeader: ts,
					bodyText: BODY,
					nowSeconds: NOW,
				}).ok,
				true,
			);
		}
		for (const timestamp of [
			NOW - SIGNATURE_TOLERANCE_SECONDS - 1,
			NOW + SIGNATURE_TOLERANCE_SECONDS + 1,
		]) {
			const { ts, signature } = signed(timestamp);
			assert.deepEqual(
				verifySignature({
					secret: SECRET,
					signatureHeader: signature,
					timestampHeader: ts,
					bodyText: BODY,
					nowSeconds: NOW,
				}),
				{ ok: false, reason: 'timestamp_out_of_tolerance' },
			);
		}
	});

	it('reports missing secret, missing headers and an invalid timestamp', () => {
		const { ts, signature } = signed(NOW);
		const base = {
			signatureHeader: signature,
			timestampHeader: ts,
			bodyText: BODY,
			nowSeconds: NOW,
		};
		assert.deepEqual(verifySignature({ ...base, secret: undefined }), {
			ok: false,
			reason: 'missing_secret',
		});
		assert.deepEqual(verifySignature({ ...base, secret: SECRET, signatureHeader: undefined }), {
			ok: false,
			reason: 'missing_headers',
		});
		assert.deepEqual(verifySignature({ ...base, secret: SECRET, timestampHeader: ['1'] }), {
			ok: false,
			reason: 'missing_headers',
		});
		assert.deepEqual(verifySignature({ ...base, secret: SECRET, timestampHeader: 'abc' }), {
			ok: false,
			reason: 'invalid_timestamp',
		});
		assert.deepEqual(verifySignature({ ...base, secret: SECRET, timestampHeader: '' }), {
			ok: false,
			reason: 'invalid_timestamp',
		});
	});
});

describe('bodyToText', () => {
	it('prefers the raw body (Buffer or string) over re-serialized JSON', () => {
		assert.equal(bodyToText(Buffer.from('{"a": 1}'), { a: 1 }), '{"a": 1}');
		assert.equal(bodyToText('{"a": 1}', { a: 1 }), '{"a": 1}');
		assert.equal(bodyToText(undefined, { a: 1 }), '{"a":1}');
	});
});

describe('KirimiTrigger webhook (automatic mode)', () => {
	const buildWebhookContext = (headers: Record<string, string>, body: string, secret?: string) => {
		const ctx = createContext({
			params: {
				registration: 'auto',
				scope: 'device',
				autoDeviceEvents: ['message'],
				autoOptions: {},
			},
			staticData: secret ? { secret } : {},
		});
		const response = { statusCode: 0, payload: undefined as unknown };
		const responseObject = {
			status(code: number) {
				response.statusCode = code;
				return responseObject;
			},
			json(payload: unknown) {
				response.payload = payload;
				return responseObject;
			},
		};
		return {
			response,
			ctx: {
				...ctx,
				getRequestObject: () => ({ headers, rawBody: Buffer.from(body) }),
				getResponseObject: () => responseObject,
				getBodyData: () => JSON.parse(body),
				getHeaderData: () => headers,
			},
		};
	};

	it('answers 401 and emits nothing when the signature is invalid', async () => {
		const ts = String(Math.floor(Date.now() / 1000));
		const { ctx, response } = buildWebhookContext(
			{ 'x-kirimi-signature': 'deadbeef', 'x-kirimi-timestamp': ts },
			BODY,
			SECRET,
		);
		const result = await new KirimiTrigger().webhook.call(ctx as never);
		assert.equal(response.statusCode, 401);
		assert.deepEqual(response.payload, { error: 'Invalid webhook signature' });
		assert.deepEqual(result, { noWebhookResponse: true });
	});

	it('answers 401 when no subscription secret is stored', async () => {
		const ts = String(Math.floor(Date.now() / 1000));
		const { ctx, response } = buildWebhookContext(
			{ 'x-kirimi-signature': computeSignature(SECRET, ts, BODY), 'x-kirimi-timestamp': ts },
			BODY,
		);
		await new KirimiTrigger().webhook.call(ctx as never);
		assert.equal(response.statusCode, 401);
	});

	it('emits the event and drops a replayed event id when the signature is valid', async () => {
		const ts = String(Math.floor(Date.now() / 1000));
		const headers = {
			'x-kirimi-signature': computeSignature(SECRET, ts, BODY),
			'x-kirimi-timestamp': ts,
		};
		const { ctx, response } = buildWebhookContext(headers, BODY, SECRET);
		const first = await new KirimiTrigger().webhook.call(ctx as never);
		assert.equal(response.statusCode, 0);
		assert.equal(first.workflowData?.[0]?.[0]?.json.event, 'message');

		const second = await new KirimiTrigger().webhook.call(ctx as never);
		assert.equal(second.workflowData, undefined);
	});
});
