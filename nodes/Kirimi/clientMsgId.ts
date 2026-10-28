export const CLIENT_MSG_ID_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;
export const CLIENT_MSG_ID_MAX_LENGTH = 128;

export const isValidClientMsgId = (value: string): boolean => CLIENT_MSG_ID_REGEX.test(value);

/** Replace every character the server does not accept and cap the length. */
export const sanitizeClientMsgId = (value: string): string =>
	value.replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, CLIENT_MSG_ID_MAX_LENGTH);

/** Small deterministic string hash (cyrb53), base36. Not cryptographic; used only to shorten names. */
export const shortHash = (input: string): string => {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < input.length; i++) {
		const ch = input.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

export interface AutoClientMsgIdInput {
	executionId: string | undefined;
	nodeName: string;
	itemIndex: number;
	/** Run index of the node inside the execution (loops). Only appended when greater than 0. */
	runIndex?: number;
}

/**
 * Stable idempotency key `n8n-<executionId>-<nodeNameHash>-<itemIndex>`. Re-running the same item of
 * the same execution yields the same key, so the server never sends the message twice.
 */
export const buildAutoClientMsgId = ({
	executionId,
	nodeName,
	itemIndex,
	runIndex = 0,
}: AutoClientMsgIdInput): string => {
	const runSuffix = runIndex > 0 ? `-r${runIndex}` : '';
	return sanitizeClientMsgId(
		`n8n-${executionId || 'manual'}-${shortHash(nodeName)}-${itemIndex}${runSuffix}`,
	);
};
