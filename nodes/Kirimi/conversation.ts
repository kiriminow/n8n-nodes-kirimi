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

/** Max length of an in-thread note sent through Add Note. */
export const MAX_ACTION_NOTE_LENGTH = 2000;
export const MAX_ACTOR_NAME_LENGTH = 100;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 100;
export const CS_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;

/** How a conversation action finds its chat: device + phone, or the Kirimi conversation id. */
export type ConversationTargetInput =
	| { by: 'devicePhone'; deviceId: string; phone: unknown }
	| { by: 'conversationId'; conversationId: string };

/** Target body fields. Throws a readable error when the target is incomplete. */
export const targetBody = (target: ConversationTargetInput): IDataObject => {
	if (target.by === 'conversationId') {
		const conversationId = String(target.conversationId ?? '').trim();
		if (!conversationId) throw new Error('Conversation ID is required');
		return { conversation_id: conversationId };
	}
	const invalid = validateIdentity(target);
	if (invalid) throw new Error(invalid);
	return identityBody(target);
};

const optionalBounded = (value: unknown, label: string, max: number): string | undefined => {
	const text = String(value ?? '').trim();
	if (!text) return undefined;
	if (text.length > max) throw new Error(`${label} must be at most ${max} characters`);
	return text;
};

const actorBody = (actorName: unknown): IDataObject => {
	const name = optionalBounded(actorName, 'Actor name', MAX_ACTOR_NAME_LENGTH);
	return name ? { actor_name: name } : {};
};

export const buildApplyMacroBody = (
	target: ConversationTargetInput,
	macroId: unknown,
	actorName?: unknown,
	idempotencyKey?: unknown,
): IDataObject => {
	const id = Number(String(macroId ?? '').trim());
	if (!Number.isInteger(id) || id <= 0) throw new Error('Macro ID must be a positive whole number');
	const key = optionalBounded(idempotencyKey, 'Idempotency key', MAX_IDEMPOTENCY_KEY_LENGTH);
	return {
		...targetBody(target),
		macro_id: id,
		...actorBody(actorName),
		...(key ? { idempotency_key: key } : {}),
	};
};

export const buildAddNoteBody = (
	target: ConversationTargetInput,
	text: unknown,
	actorName?: unknown,
): IDataObject => {
	const note = String(text ?? '').trim();
	if (!note) throw new Error('Note text is required');
	if (note.length > MAX_ACTION_NOTE_LENGTH) {
		throw new Error(`Note must be at most ${MAX_ACTION_NOTE_LENGTH} characters`);
	}
	return { ...targetBody(target), text: note, ...actorBody(actorName) };
};

/** `clear` sends `category_id: null` (removes the category); otherwise a category id is required. */
export const buildSetCategoryBody = (
	target: ConversationTargetInput,
	categoryId: unknown,
	clear: boolean,
): IDataObject => {
	if (clear === true) return { ...targetBody(target), category_id: null };
	const id = String(categoryId ?? '').trim();
	if (!id) throw new Error('Category is required (or enable Clear Category)');
	return { ...targetBody(target), category_id: id };
};

export const buildSetCsStatusBody = (
	target: ConversationTargetInput,
	status: unknown,
): IDataObject => {
	const value = String(status ?? '').trim();
	if (!(CS_STATUSES as readonly string[]).includes(value)) {
		throw new Error(`Status must be one of: ${CS_STATUSES.join(', ')}`);
	}
	return { ...targetBody(target), status: value };
};

export const CONVERSATION_ENDPOINTS = {
	handoff: '/v1/conversations/handoff',
	getStatus: '/v1/conversations/status',
	release: '/v1/conversations/release',
	listAssignees: '/v1/team/assignees',
	runMacro: '/v1/conversations/apply-macro',
	addNote: '/v1/conversations/add-note',
	setCategory: '/v1/conversations/set-category',
	setCsStatus: '/v1/conversations/set-cs-status',
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
