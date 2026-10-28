import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	DEVICE_EVENTS,
	MAX_SUBSCRIPTION_EVENTS,
	WABA_EVENTS,
	allEventOptions,
	deviceEventOptions,
	wabaEventOptions,
} from '../nodes/Kirimi/events';

describe('event option builders', () => {
	it('builds one option per device and WABA event with a readable name', () => {
		assert.deepEqual(
			deviceEventOptions().map((option) => option.value),
			DEVICE_EVENTS,
		);
		assert.deepEqual(
			wabaEventOptions().map((option) => option.value),
			WABA_EVENTS,
		);
		for (const option of [...deviceEventOptions(), ...wabaEventOptions()]) {
			assert.ok((option.name && option.name !== option.value) || option.value === 'qr');
		}
		assert.equal(
			deviceEventOptions().find((o) => o.value === 'message')?.name,
			'Message (Incoming)',
		);
	});

	it('has no duplicate values and respects the subscription cap', () => {
		assert.equal(new Set(DEVICE_EVENTS).size, DEVICE_EVENTS.length);
		assert.equal(new Set(WABA_EVENTS).size, WABA_EVENTS.length);
		assert.equal(MAX_SUBSCRIPTION_EVENTS, 20);
	});

	it('allEventOptions is the union, labelling WABA-only events', () => {
		const all = allEventOptions();
		const values = all.map((option) => option.value);
		assert.equal(new Set(values).size, values.length);
		assert.deepEqual(new Set(values), new Set([...DEVICE_EVENTS, ...WABA_EVENTS]));
		const wabaOnly = WABA_EVENTS.filter((event) => !DEVICE_EVENTS.includes(event));
		assert.ok(wabaOnly.length > 0);
		for (const event of wabaOnly) {
			assert.match(all.find((o) => o.value === event)?.name ?? '', /\(WABA\)$/);
		}
		for (const event of DEVICE_EVENTS) {
			assert.doesNotMatch(all.find((o) => o.value === event)?.name ?? '', /\(WABA\)$/);
		}
	});
});
