export const MAX_REMEMBERED_EVENT_IDS = 200;

export interface DedupeResult {
	duplicate: boolean;
	/** The ring buffer to store: oldest ids are dropped once `max` is exceeded. */
	seen: string[];
}

/** Bounded ring buffer of recently seen event ids. Does not mutate its input. */
export const rememberEventId = (
	seen: string[] | undefined,
	eventId: string | undefined,
	max = MAX_REMEMBERED_EVENT_IDS,
): DedupeResult => {
	const current = seen ?? [];
	if (!eventId) return { duplicate: false, seen: current };
	if (current.includes(eventId)) return { duplicate: true, seen: current };
	return { duplicate: false, seen: [...current, eventId].slice(-max) };
};
