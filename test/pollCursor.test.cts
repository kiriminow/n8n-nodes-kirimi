import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	initialPollState,
	selectNewEvents,
	type PollEvent,
} from '../nodes/KirimiPollTrigger/pollCursor';

const event = (id: string, createdAt: string): PollEvent => ({
	id,
	event: 'message',
	created_at: createdAt,
});

describe('selectNewEvents', () => {
	const newestFirst = [
		event('c', '2026-10-28T10:00:03.000Z'),
		event('b', '2026-10-28T10:00:02.000Z'),
		event('a', '2026-10-28T10:00:01.000Z'),
	];

	it('first run records the cursor and emits nothing', () => {
		const { emit, state } = selectNewEvents(newestFirst, initialPollState());
		assert.deepEqual(emit, []);
		assert.equal(state.initialized, true);
		assert.equal(state.cursor, '2026-10-28T10:00:03.000Z');
		assert.deepEqual(new Set(state.seenIds), new Set(['a', 'b', 'c']));
	});

	it('first run with no events still initializes, so later events are emitted', () => {
		const first = selectNewEvents([], initialPollState());
		assert.deepEqual(first.state, { initialized: true, cursor: null, seenIds: [] });
		const second = selectNewEvents(newestFirst, first.state);
		assert.deepEqual(
			second.emit.map((e) => e.id),
			['a', 'b', 'c'],
		);
	});

	it('emits only newer events, oldest first, and advances the cursor', () => {
		const initial = selectNewEvents(newestFirst.slice(1), initialPollState()).state;
		const next = [
			event('e', '2026-10-28T10:00:05.000Z'),
			event('d', '2026-10-28T10:00:04.000Z'),
			...newestFirst,
		];
		const { emit, state } = selectNewEvents(next, initial);
		assert.deepEqual(
			emit.map((e) => e.id),
			['c', 'd', 'e'],
		);
		assert.equal(state.cursor, '2026-10-28T10:00:05.000Z');
		assert.deepEqual(selectNewEvents(next, state).emit, []);
	});

	it('handles events sharing the cursor timestamp using the seen id set', () => {
		const t = '2026-10-28T10:00:00.000Z';
		const initial = selectNewEvents([event('x1', t)], initialPollState()).state;
		const { emit, state } = selectNewEvents([event('x2', t), event('x1', t)], initial);
		assert.deepEqual(
			emit.map((e) => e.id),
			['x2'],
		);
		assert.deepEqual(selectNewEvents([event('x2', t), event('x1', t)], state).emit, []);
	});

	it('ignores events older than the cursor that were never seen', () => {
		const initial = selectNewEvents(
			[event('n', '2026-10-28T10:00:10.000Z')],
			initialPollState(),
		).state;
		assert.deepEqual(selectNewEvents([event('old', '2026-10-28T09:00:00.000Z')], initial).emit, []);
	});

	it('bounds the seen id set', () => {
		let state = selectNewEvents([], initialPollState()).state;
		for (let i = 0; i < 20; i++) {
			const ts = new Date(Date.UTC(2026, 9, 28, 10, 0, i)).toISOString();
			state = selectNewEvents([event(`id${i}`, ts)], state, 5).state;
		}
		assert.equal(state.seenIds.length, 5);
		assert.deepEqual(state.seenIds.slice(-1), ['id19']);
	});

	it('skips items without an id', () => {
		const initial = selectNewEvents([], initialPollState()).state;
		const bad = {
			event: 'message',
			created_at: '2026-10-28T10:00:00.000Z',
		} as unknown as PollEvent;
		assert.deepEqual(selectNewEvents([bad], initial).emit, []);
	});
});
