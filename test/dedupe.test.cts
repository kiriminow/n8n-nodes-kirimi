import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MAX_REMEMBERED_EVENT_IDS, rememberEventId } from '../nodes/KirimiTrigger/dedupe';

describe('rememberEventId', () => {
	it('remembers new ids and flags repeats', () => {
		const first = rememberEventId(undefined, 'a');
		assert.deepEqual(first, { duplicate: false, seen: ['a'] });
		const second = rememberEventId(first.seen, 'a');
		assert.equal(second.duplicate, true);
		assert.deepEqual(second.seen, ['a']);
	});

	it('never treats a missing id as a duplicate and does not store it', () => {
		assert.deepEqual(rememberEventId(['a'], undefined), { duplicate: false, seen: ['a'] });
		assert.deepEqual(rememberEventId(['a'], ''), { duplicate: false, seen: ['a'] });
	});

	it('is a bounded ring buffer: the oldest ids fall out', () => {
		let seen: string[] = [];
		for (let i = 0; i < 5; i++) seen = rememberEventId(seen, `id-${i}`, 3).seen;
		assert.deepEqual(seen, ['id-2', 'id-3', 'id-4']);
		assert.equal(rememberEventId(seen, 'id-0', 3).duplicate, false);
	});

	it('defaults to 200 remembered ids', () => {
		assert.equal(MAX_REMEMBERED_EVENT_IDS, 200);
		let seen: string[] = [];
		for (let i = 0; i < 250; i++) seen = rememberEventId(seen, `e${i}`).seen;
		assert.equal(seen.length, 200);
		assert.equal(seen[0], 'e50');
	});

	it('does not mutate the input array', () => {
		const input = ['a'];
		rememberEventId(input, 'b');
		assert.deepEqual(input, ['a']);
	});
});
