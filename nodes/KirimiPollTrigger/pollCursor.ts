export const MAX_SEEN_IDS = 500;
export const POLL_FETCH_LIMIT = 100;

export interface PollEvent {
	id: string;
	event?: string;
	created_at?: string;
	[key: string]: unknown;
}

export interface PollState {
	/** False until the first poll ran; the first poll only records a cursor and emits nothing. */
	initialized: boolean;
	/** created_at of the newest event handled so far. */
	cursor: string | null;
	/** Ids at or after the cursor that were already handled (bounded). */
	seenIds: string[];
}

export interface PollSelection {
	/** Events to emit, oldest first. */
	emit: PollEvent[];
	state: PollState;
}

export const initialPollState = (): PollState => ({
	initialized: false,
	cursor: null,
	seenIds: [],
});

const toMillis = (value: string | undefined | null): number => {
	if (!value) return Number.NaN;
	return Date.parse(value);
};

const newestCreatedAt = (events: PollEvent[], current: string | null): string | null => {
	let best = current;
	let bestMs = toMillis(current);
	for (const event of events) {
		const ms = toMillis(event.created_at);
		if (Number.isNaN(ms)) continue;
		if (Number.isNaN(bestMs) || ms > bestMs) {
			best = event.created_at as string;
			bestMs = ms;
		}
	}
	return best;
};

const bounded = (ids: string[], max: number): string[] => ids.slice(-max);

/**
 * Decide which events of a poll response (newest first) are new.
 *
 * - First poll: record the cursor, mark everything fetched as seen, emit nothing.
 * - Later polls: an event is new when it is newer than the cursor, or has the same timestamp and an
 *   id that was not seen yet. New events are returned oldest first.
 */
export const selectNewEvents = (
	itemsNewestFirst: PollEvent[],
	state: PollState,
	maxSeen = MAX_SEEN_IDS,
): PollSelection => {
	const items = itemsNewestFirst.filter((item) => item && typeof item.id === 'string' && item.id);

	if (!state.initialized) {
		return {
			emit: [],
			state: {
				initialized: true,
				cursor: newestCreatedAt(items, null),
				seenIds: bounded(items.map((item) => item.id).reverse(), maxSeen),
			},
		};
	}

	const seen = new Set(state.seenIds);
	const cursorMs = toMillis(state.cursor);
	const hasCursor = !Number.isNaN(cursorMs);

	const fresh = items.filter((item) => {
		if (seen.has(item.id)) return false;
		const ms = toMillis(item.created_at);
		if (Number.isNaN(ms) || !hasCursor) return true;
		return ms >= cursorMs;
	});

	// API order is newest first: reverse for oldest first, then stable-sort by timestamp.
	const emit = [...fresh].reverse().sort((a, b) => {
		const diff = toMillis(a.created_at) - toMillis(b.created_at);
		return Number.isNaN(diff) ? 0 : diff;
	});

	return {
		emit,
		state: {
			initialized: true,
			cursor: newestCreatedAt(emit, state.cursor),
			seenIds: bounded([...state.seenIds, ...emit.map((item) => item.id)], maxSeen),
		},
	};
};
