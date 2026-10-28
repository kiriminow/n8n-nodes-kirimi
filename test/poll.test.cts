import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { KirimiPollTrigger } from '../nodes/KirimiPollTrigger/KirimiPollTrigger.node';
import { createContext, type RecordedRequest } from './helpers.cjs';

const ev = (id: string, second: number) => ({
	id,
	event: 'message',
	created_at: new Date(Date.UTC(2026, 9, 28, 10, 0, second)).toISOString(),
	text: `m-${id}`,
});

const setup = (mode: 'manual' | 'trigger', params: Record<string, unknown> = {}) => {
	const state = { items: [] as unknown[] };
	const ctx = createContext({
		mode,
		params: {
			scope: 'device',
			deviceId: { mode: 'list', value: 'D-1' },
			deviceEvents: ['message', 'message.sent'],
			...params,
		},
		respond: (request: RecordedRequest) => {
			if (request.options.url?.endsWith('/v1/webhook/subscribe')) return { data: { id: 'sub-1' } };
			if (request.options.url?.endsWith('/v1/webhook/events'))
				return { data: { items: state.items } };
			return { success: true };
		},
	});
	return { ctx, state };
};

const poll = async (ctx: ReturnType<typeof setup>['ctx']) =>
	await new KirimiPollTrigger().poll.call(ctx as never);

describe('KirimiPollTrigger.poll', () => {
	it('subscribes in poll mode without target_url, then seeds the cursor silently', async () => {
		const { ctx, state } = setup('trigger');
		state.items = [ev('b', 2), ev('a', 1)];
		assert.equal(await poll(ctx), null);

		const subscribe = ctx.requests.find((r) => r.options.url?.endsWith('/v1/webhook/subscribe'));
		const body = subscribe?.options.body as Record<string, unknown>;
		assert.equal(body.delivery, 'poll');
		assert.equal(body.device_id, 'D-1');
		assert.deepEqual(body.events, ['message', 'message.sent']);
		assert.equal('target_url' in body, false);
		assert.equal(ctx.staticData.pollSubscriptionId, 'sub-1');

		const fetch = ctx.requests.find((r) => r.options.url?.endsWith('/v1/webhook/events'));
		assert.deepEqual(fetch?.options.body, {
			device_id: 'D-1',
			events: ['message', 'message.sent'],
			limit: 100,
		});
	});

	it('emits new events oldest first on later polls and subscribes only once', async () => {
		const { ctx, state } = setup('trigger');
		state.items = [ev('a', 1)];
		await poll(ctx);

		state.items = [ev('c', 3), ev('b', 2), ev('a', 1)];
		const result = await poll(ctx);
		assert.deepEqual(
			result?.[0].map((item) => item.json.id),
			['b', 'c'],
		);

		assert.equal(await poll(ctx), null);
		const subscribes = ctx.requests.filter((r) => r.options.url?.endsWith('/v1/webhook/subscribe'));
		assert.equal(subscribes.length, 1);
	});

	it('re-subscribes and resets the cursor when the scope changes', async () => {
		const { ctx, state } = setup('trigger');
		state.items = [ev('a', 1)];
		await poll(ctx);
		(ctx as { getNodeParameter: unknown }).getNodeParameter = (...args: unknown[]) => {
			const name = args[0] as string;
			if (name === 'deviceId') return 'D-2';
			if (name === 'scope') return 'device';
			if (name === 'deviceEvents') return ['message', 'message.sent'];
			return undefined;
		};
		state.items = [ev('z', 9)];
		assert.equal(await poll(ctx), null);
		const subscribes = ctx.requests.filter((r) => r.options.url?.endsWith('/v1/webhook/subscribe'));
		assert.equal(subscribes.length, 2);
		assert.ok(ctx.requests.some((r) => r.options.url?.endsWith('/v1/webhook/unsubscribe')));
	});

	it('manual mode returns the latest event and does not move the cursor', async () => {
		const { ctx, state } = setup('manual');
		state.items = [ev('b', 2), ev('a', 1)];
		const result = await poll(ctx);
		assert.deepEqual(
			result?.[0].map((item) => item.json.id),
			['b'],
		);
		assert.equal(ctx.staticData.pollState, undefined);
	});

	it('manual mode with no events returns null', async () => {
		const { ctx } = setup('manual');
		assert.equal(await poll(ctx), null);
	});

	it('uses waba_id for the WABA scope', async () => {
		const { ctx, state } = setup('trigger', {
			scope: 'waba',
			wabaId: { mode: 'id', value: 'W-1' },
			wabaEvents: ['message'],
		});
		state.items = [];
		await poll(ctx);
		const body = ctx.requests[0].options.body as Record<string, unknown>;
		assert.equal(body.waba_id, 'W-1');
		assert.equal('device_id' in body, false);
	});
});
