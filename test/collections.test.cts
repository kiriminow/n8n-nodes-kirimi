import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kirimiApiRequestAllItems } from '../nodes/Kirimi/GenericFunctions';
import { Kirimi } from '../nodes/Kirimi/Kirimi.node';
import { createContext, type RecordedRequest } from './helpers.cjs';

type Body = Record<string, unknown>;

const bodyOf = (request: RecordedRequest): Body => request.options.body as Body;

/** Server stand-in: `total` records, paged by the `page` and `limit` of the request body. */
const pagedServer =
	(total: number, wrap: (rows: unknown[]) => unknown) => (request: RecordedRequest) => {
		const { page, limit } = bodyOf(request) as { page: number; limit: number };
		const all = Array.from({ length: total }, (_, index) => ({ id: index + 1 }));
		return wrap(all.slice((page - 1) * limit, page * limit));
	};

const wrapDevices = (rows: unknown[]) => ({ success: true, data: { devices: rows } });

describe('kirimiApiRequestAllItems', () => {
	it('fetches every page when no limit is given and stops on a short page', async () => {
		const ctx = createContext({ params: {}, respond: pagedServer(250, wrapDevices) });
		const result = await kirimiApiRequestAllItems.call(
			ctx as never,
			'/v1/list-devices',
			{},
			'data.devices',
		);
		assert.equal(result.length, 250);
		assert.deepEqual(
			ctx.requests.map((r) => [bodyOf(r).page, bodyOf(r).limit]),
			[
				[1, 100],
				[2, 100],
				[3, 100],
			],
		);
	});

	it('stops after an empty page when the total is a multiple of the page size', async () => {
		const ctx = createContext({ params: {}, respond: pagedServer(200, wrapDevices) });
		const result = await kirimiApiRequestAllItems.call(
			ctx as never,
			'/v1/list-devices',
			{},
			'data.devices',
		);
		assert.equal(result.length, 200);
		assert.equal(ctx.requests.length, 3);
	});

	it('cuts to the limit and does not request more pages than needed', async () => {
		const ctx = createContext({ params: {}, respond: pagedServer(500, wrapDevices) });
		const result = await kirimiApiRequestAllItems.call(
			ctx as never,
			'/v1/list-devices',
			{},
			'data.devices',
			150,
		);
		assert.equal(result.length, 150);
		assert.equal(ctx.requests.length, 2);
	});

	it('uses a smaller page size for a small limit and keeps extra body fields', async () => {
		const ctx = createContext({ params: {}, respond: pagedServer(500, wrapDevices) });
		const result = await kirimiApiRequestAllItems.call(
			ctx as never,
			'/v1/list-deposits',
			{ status: 'paid' },
			'data.devices',
			30,
		);
		assert.equal(result.length, 30);
		assert.equal(ctx.requests.length, 1);
		assert.deepEqual(bodyOf(ctx.requests[0]), { status: 'paid', page: 1, limit: 30 });
	});

	it('returns nothing when the path is missing', async () => {
		const ctx = createContext({ params: {}, respond: () => ({ success: true }) });
		const result = await kirimiApiRequestAllItems.call(ctx as never, '/x', {}, 'data.items');
		assert.deepEqual(result, []);
		assert.equal(ctx.requests.length, 1);
	});
});

const run = async (params: Record<string, unknown>, typeVersion: number, respond?: never) => {
	const ctx = createContext({
		params,
		typeVersion,
		mode: 'manual',
		executionId: 'exec-9',
		respond: respond ?? ((): unknown => ({ success: true })),
	});
	const output = await new Kirimi().execute.call(ctx as never);
	return { ctx, output };
};

describe('node version 3', () => {
	it('Send Message reads additionalFields and sends the same body as version 2', async () => {
		const common = {
			resource: 'message',
			operation: 'sendMessage',
			deviceId: { __rl: true, mode: 'id', value: 'D-1' },
			receiver: '62811',
			message: 'hi',
		};
		const v2 = await run(
			{
				...common,
				mediaUrl: 'https://x.test/a.png',
				quotedMessageId: 'Q1',
				autoClientMsgId: true,
				enableTypingEffect: true,
				typingSpeedMs: 350,
				fileName: '',
				clientMsgId: '',
			},
			2,
		);
		const v3 = await run(
			{
				...common,
				additionalFields: {
					mediaUrl: 'https://x.test/a.png',
					quotedMessageId: 'Q1',
					autoClientMsgId: true,
					enableTypingEffect: true,
				},
			},
			3,
		);
		assert.deepEqual(bodyOf(v3.ctx.requests[0]), bodyOf(v2.ctx.requests[0]));
		assert.deepEqual(bodyOf(v3.ctx.requests[0]), {
			device_id: 'D-1',
			receiver: '62811',
			message: 'hi',
			media_url: 'https://x.test/a.png',
			quotedMessageId: 'Q1',
			enableTypingEffect: true,
			typingSpeedMs: 350,
		});
		assert.equal(
			v3.ctx.requests[0].options.headers?.['Idempotency-Key'],
			v2.ctx.requests[0].options.headers?.['Idempotency-Key'],
		);
		assert.match(String(v3.output[0][0].json.clientMsgId), /^n8n-exec-9-/);
	});

	it('Send Message sends only the required fields without additionalFields', async () => {
		const { ctx } = await run(
			{
				resource: 'message',
				operation: 'sendMessage',
				deviceId: 'D-1',
				receiver: '62811',
				message: 'hi',
				additionalFields: {},
			},
			3,
		);
		assert.deepEqual(bodyOf(ctx.requests[0]), {
			device_id: 'D-1',
			receiver: '62811',
			message: 'hi',
		});
		assert.equal(ctx.requests[0].options.headers, undefined);
	});

	it('List Devices returns one item per device and pages on Return All', async () => {
		const { ctx, output } = await run(
			{ resource: 'device', operation: 'listDevices', returnAll: true },
			3,
			pagedServer(120, wrapDevices) as never,
		);
		assert.equal(output[0].length, 120);
		assert.deepEqual(output[0][0].json, { id: 1 });
		assert.equal(ctx.requests.length, 2);
	});

	it('List Devices honours the limit', async () => {
		const { ctx, output } = await run(
			{ resource: 'device', operation: 'listDevices', returnAll: false, limit: 5 },
			3,
			pagedServer(120, wrapDevices) as never,
		);
		assert.equal(output[0].length, 5);
		assert.deepEqual(bodyOf(ctx.requests[0]), { page: 1, limit: 5 });
	});

	it('List Deposits applies the status filter', async () => {
		const { ctx, output } = await run(
			{
				resource: 'deposit',
				operation: 'listDeposits',
				returnAll: false,
				limit: 10,
				filters: { status: 'paid' },
			},
			3,
			pagedServer(3, (rows) => ({ data: { deposits: rows } })) as never,
		);
		assert.equal(output[0].length, 3);
		assert.equal(bodyOf(ctx.requests[0]).status, 'paid');
	});

	it('List Conversations reads data.items', async () => {
		const { output } = await run(
			{ resource: 'waba', operation: 'listConversations', returnAll: true },
			3,
			pagedServer(4, (rows) => ({ data: { items: rows } })) as never,
		);
		assert.equal(output[0].length, 4);
	});

	it('Save Contact reads the device from additionalFields (resource locator or string)', async () => {
		const locator = await run(
			{
				resource: 'contact',
				operation: 'saveContact',
				nama: 'Budi',
				nomor: '628',
				additionalFields: { deviceId: { __rl: true, mode: 'list', value: ' D-7 ' } },
			},
			3,
		);
		assert.equal(bodyOf(locator.ctx.requests[0]).device_id, 'D-7');
		const plain = await run(
			{
				resource: 'contact',
				operation: 'saveContact',
				nama: 'Budi',
				nomor: '628',
				additionalFields: { deviceId: 'D-8' },
			},
			3,
		);
		assert.equal(bodyOf(plain.ctx.requests[0]).device_id, 'D-8');
	});

	it('Subscribe and List Events read the label and the filter from collections', async () => {
		const subscribe = await run(
			{
				resource: 'webhook',
				operation: 'subscribe',
				webhookScope: 'device',
				webhookDeviceId: 'D-1',
				targetUrl: 'https://x.test/hook',
				webhookDeviceEvents: ['message'],
				additionalFields: { label: 'main' },
			},
			3,
		);
		assert.equal(bodyOf(subscribe.ctx.requests[0]).label, 'main');
		const list = await run(
			{
				resource: 'webhook',
				operation: 'listEvents',
				webhookScope: 'device',
				webhookDeviceId: 'D-1',
				webhookEventsLimit: 20,
				filters: { events: ['message'] },
			},
			3,
			(() => ({ data: { items: [] } })) as never,
		);
		assert.deepEqual(bodyOf(list.ctx.requests[0]).events, ['message']);
	});

	it('Broadcast still requires a message or a media URL', async () => {
		await assert.rejects(
			run(
				{
					resource: 'message',
					operation: 'broadcastMessage',
					deviceId: 'D-1',
					label: 'L',
					numbers: '628,629',
					message: '',
					additionalFields: {},
				},
				3,
			),
			/Provide a Broadcast Message/,
		);
	});
});

describe('node version 2 keeps the old behavior', () => {
	it('List Devices sends page and limit from the old fields and returns the raw response', async () => {
		const { ctx, output } = await run(
			{ resource: 'device', operation: 'listDevices', listDevicesPage: 3, listDevicesLimit: 25 },
			2,
			(() => ({ success: true, data: { devices: [{ id: 1 }] } })) as never,
		);
		assert.deepEqual(bodyOf(ctx.requests[0]), { page: 3, limit: 25 });
		assert.equal(ctx.requests.length, 1);
		assert.equal(output[0].length, 1);
		assert.deepEqual(output[0][0].json, { success: true, data: { devices: [{ id: 1 }] } });
	});
});
