import { createHmac, timingSafeEqual } from 'crypto';

export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type VerifyFailure =
	| 'missing_secret'
	| 'missing_headers'
	| 'invalid_timestamp'
	| 'timestamp_out_of_tolerance'
	| 'signature_mismatch';

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailure };

export interface VerifyInput {
	/** Subscription secret returned by POST /v1/webhook/subscribe. */
	secret: string | undefined;
	/** X-Kirimi-Signature header, `<hex>` or `sha256=<hex>`. */
	signatureHeader: unknown;
	/** X-Kirimi-Timestamp header, unix seconds. */
	timestampHeader: unknown;
	/** The exact body text that was signed. */
	bodyText: string;
	/** Unix seconds, injectable for tests. */
	nowSeconds?: number;
	toleranceSeconds?: number;
}

/** hex(HMAC-SHA256(secret, `${timestamp}.${body}`)) */
export const computeSignature = (secret: string, timestamp: string, bodyText: string): string =>
	createHmac('sha256', secret).update(`${timestamp}.${bodyText}`).digest('hex');

export const verifySignature = ({
	secret,
	signatureHeader,
	timestampHeader,
	bodyText,
	nowSeconds = Date.now() / 1000,
	toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
}: VerifyInput): VerifyResult => {
	if (!secret) return { ok: false, reason: 'missing_secret' };
	if (typeof signatureHeader !== 'string' || typeof timestampHeader !== 'string') {
		return { ok: false, reason: 'missing_headers' };
	}

	const timestamp = Number(timestampHeader);
	if (!timestampHeader.trim() || !Number.isFinite(timestamp)) {
		return { ok: false, reason: 'invalid_timestamp' };
	}
	if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
		return { ok: false, reason: 'timestamp_out_of_tolerance' };
	}

	const expected = Buffer.from(computeSignature(secret, timestampHeader, bodyText), 'utf8');
	const received = Buffer.from(
		signatureHeader
			.trim()
			.replace(/^sha256=/i, '')
			.toLowerCase(),
		'utf8',
	);
	if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
		return { ok: false, reason: 'signature_mismatch' };
	}
	return { ok: true };
};

/** Prefer the raw request body (exact bytes that were signed); fall back to re-serialized JSON. */
export const bodyToText = (rawBody: Buffer | string | undefined, parsedBody: unknown): string => {
	if (rawBody === undefined) return JSON.stringify(parsedBody);
	return Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
};
