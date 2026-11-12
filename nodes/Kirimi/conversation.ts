import type { IDataObject } from 'n8n-workflow';

/** Max length of the handoff / release note accepted by the API. */
export const MAX_NOTE_LENGTH = 1000;

/** Normalize a customer number like the Kirimi server: digits only, leading 0 becomes 62. */
export const normalizePhone = (value: unknown): string => {
	const digits = String(value ?? '')
		.replace(/@.*$/, '')
		.replace(/\D/g, '');
	return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
};

export interface ConversationIdentity {
	deviceId: string;
	phone: unknown;
}

/** Reject a missing device or phone before any request is made. Returns an error message or undefined. */
export const validateIdentity = ({ deviceId, phone }: ConversationIdentity): string | undefined => {
	if (!deviceId.trim()) return 'Device is required (QR device ID or WABA phone number ID)';
	if (!normalizePhone(phone)) return 'Phone is required (customer number, e.g. 628123456789)';
	return undefined;
};

export interface AssigneeSelection {
	/** Locator mode: `list` and `id` carry a team ID, `email` carries an email address. */
	mode: string;
	value: string;
}

/** Read a resource locator value ({ mode, value }) or a bare string into an assignee selection. */
export const readAssignee = (raw: unknown): AssigneeSelection => {
	if (raw && typeof raw === 'object' && 'value' in raw) {
		const { mode, value } = raw as { mode?: unknown; value?: unknown };
		return { mode: typeof mode === 'string' ? mode : 'list', value: String(value ?? '').trim() };
	}
	return { mode: 'list', value: String(raw ?? '').trim() };
};

/** Body fields for the optional assignee: `assignee_team_id` (number) or `assignee_email`. Empty when unset. */
export const assigneeBody = (selection: AssigneeSelection): IDataObject => {
	if (!selection.value) return {};
	if (selection.mode === 'email') return { assignee_email: selection.value.toLowerCase() };
	const teamId = Number(selection.value);
	if (!Number.isInteger(teamId) || teamId <= 0) {
		throw new Error('Assignee team ID must be a positive whole number');
	}
	return { assignee_team_id: teamId };
};

const noteBody = (note: unknown): IDataObject => {
	const text = String(note ?? '').trim();
	if (!text) return {};
	if (text.length > MAX_NOTE_LENGTH) {
		throw new Error(`Note must be at most ${MAX_NOTE_LENGTH} characters`);
	}
	return { note: text };
};

const identityBody = ({ deviceId, phone }: ConversationIdentity): IDataObject => ({
	device_id: deviceId.trim(),
	phone: normalizePhone(phone),
});

export const buildHandoffBody = (
	identity: ConversationIdentity,
	assignee: AssigneeSelection,
	note: unknown,
): IDataObject => ({
	...identityBody(identity),
	...assigneeBody(assignee),
	...noteBody(note),
});

export const buildStatusBody = (identity: ConversationIdentity): IDataObject =>
	identityBody(identity);

/** `force: true` is sent only when enabled (the API answers 409 for a chat a CS agent took over manually). */
export const buildReleaseBody = (
	identity: ConversationIdentity,
	note: unknown,
	force = false,
): IDataObject => ({
	...identityBody(identity),
	...noteBody(note),
	...(force === true ? { force: true } : {}),
});

export const CONVERSATION_ENDPOINTS = {
	handoff: '/v1/conversations/handoff',
	getStatus: '/v1/conversations/status',
	release: '/v1/conversations/release',
	listAssignees: '/v1/team/assignees',
} as const;

/** Unwrap `{ success, data }` to the data object, passing through anything else. */
export const unwrapData = (response: unknown): IDataObject => {
	if (response && typeof response === 'object' && !Array.isArray(response)) {
		const data = (response as IDataObject).data;
		if (data && typeof data === 'object' && !Array.isArray(data)) return data as IDataObject;
	}
	return (response ?? {}) as IDataObject;
};

/** Records of the List Assignees response: `data` is an array of seats (or `data.items`). */
export const assigneesFromResponse = (response: unknown): IDataObject[] => {
	const data =
		response && typeof response === 'object' ? (response as IDataObject).data : undefined;
	if (Array.isArray(data)) return data as IDataObject[];
	const items = data && typeof data === 'object' ? (data as IDataObject).items : undefined;
	return Array.isArray(items) ? (items as IDataObject[]) : [];
};
