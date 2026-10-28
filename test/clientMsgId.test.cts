import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	CLIENT_MSG_ID_REGEX,
	buildAutoClientMsgId,
	isValidClientMsgId,
	sanitizeClientMsgId,
	shortHash,
} from '../nodes/Kirimi/clientMsgId';
import { Kirimi } from '../nodes/Kirimi/Kirimi.node';
import { createContext } from './helpers.cjs';

describe('client message id', () => {
	it('regex accepts 1-128 chars of [A-Za-z0-9._:-] only', () => {
		for (const ok of ['a', 'order-1001', 'a.b_c:d-e', 'X'.repeat(128)]) {
			assert.ok(CLIENT_MSG_ID_REGEX.test(ok), ok);
		}
		for (const bad of ['', 'has space', 'slash/', 'emoji😀', 'X'.repeat(129), 'a\nb']) {
			assert.equal(isValidClientMsgId(bad), false, bad);
		}
	});

	it('sanitize replaces invalid characters and caps the length', () => {
		assert.equal(sanitizeClientMsgId('a b/c'), 'a_b_c');
		assert.equal(sanitizeClientMsgId('x'.repeat(300)).length, 128);
		assert.ok(isValidClientMsgId(sanitizeClientMsgId('Node #1 (äö) / run')));
	});

	it('shortHash is deterministic and distinguishes names', () => {
		assert.equal(shortHash('Kirimi'), shortHash('Kirimi'));
		assert.notEqual(shortHash('Kirimi'), shortHash('Kirimi1'));
	});

	it('auto id has the documented shape and is stable for the same item', () => {
		const input = { executionId: '1234', nodeName: 'Send Receipt', itemIndex: 2 };
		const id = buildAutoClientMsgId(input);
		assert.match(id, new RegExp(`^n8n-1234-${shortHash('Send Receipt')}-2$`));
		assert.equal(buildAutoClientMsgId(input), id);
		assert.notEqual(buildAutoClientMsgId({ ...input, itemIndex: 3 }), id);
		assert.notEqual(buildAutoClientMsgId({ ...input, executionId: '1235' }), id);
		assert.notEqual(buildAutoClientMsgId({ ...input, nodeName: 'Other' }), id);
	});

	it('auto id appends the run index only after the first run, and is always valid', () => {
		const base = { executionId: 'e', nodeName: 'N', itemIndex: 0 };
		assert.ok(!buildAutoClientMsgId({ ...base, runIndex: 0 }).includes('-r'));
		assert.ok(buildAutoClientMsgId({ ...base, runIndex: 2 }).endsWith('-0-r2'));
		const nasty = buildAutoClientMsgId({
			executionId: 'a b/c'.repeat(80),
			nodeName: 'N',
			itemIndex: 0,
		});
		assert.ok(isValidClientMsgId(nasty));
		assert.equal(
			buildAutoClientMsgId({ ...base, executionId: undefined }).startsWith('n8n-manual-'),
			true,
		);
	});
});

describe('Kirimi node: Auto-Generate Client Message ID', () => {
	const run = async (params: Record<string, unknown>, executionId = 'exec-9') => {
		const ctx = createContext({
			executionId,
			nodeName: 'Send WA',
			params: {
				resource: 'message',
				operation: 'sendMessage',
				deviceId: { mode: 'list', value: 'D-1' },
				receiver: '62812',
				message: 'hi',
				mediaUrl: '',
				fileName: '',
				quotedMessageId: '',
				enableTypingEffect: false,
				clientMsgId: '',
				...params,
			},
			respond: () => ({ success: true, data: { status: 'sent' } }),
		});
		const output = await new Kirimi().execute.call(ctx as never);
		return { ctx, output };
	};

	it('does nothing by default (backward compatible)', async () => {
		const { ctx, output } = await run({ autoClientMsgId: false });
		assert.equal(ctx.requests[0].options.headers, undefined);
		assert.equal(output[0][0].json.clientMsgId, undefined);
	});

	it('sends a stable Idempotency-Key and returns it in the output', async () => {
		const first = await run({ autoClientMsgId: true });
		const again = await run({ autoClientMsgId: true });
		const key = first.ctx.requests[0].options.headers?.['Idempotency-Key'];
		assert.ok(key && isValidClientMsgId(key));
		assert.equal(key, again.ctx.requests[0].options.headers?.['Idempotency-Key']);
		assert.equal(first.output[0][0].json.clientMsgId, key);
		const other = await run({ autoClientMsgId: true }, 'exec-10');
		assert.notEqual(other.ctx.requests[0].options.headers?.['Idempotency-Key'], key);
	});

	it('an explicit Client Message ID always wins', async () => {
		const { ctx, output } = await run({ autoClientMsgId: true, clientMsgId: 'order-7' });
		assert.equal(ctx.requests[0].options.headers?.['Idempotency-Key'], 'order-7');
		assert.equal(output[0][0].json.clientMsgId, undefined);
	});

	it('rejects an invalid explicit Client Message ID', async () => {
		await assert.rejects(run({ clientMsgId: 'bad id!' }), /Client Message ID must be 1-128/);
	});
});
