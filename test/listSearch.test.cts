import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Kirimi } from '../nodes/Kirimi/Kirimi.node';
import {
	DEVICES_PAGE_SIZE,
	devicesToResults,
	nextPageToken,
	searchDevices,
	searchWabaAccounts,
	wabaAccountsToResults,
} from '../nodes/Kirimi/listSearch';
import { createContext } from './helpers.cjs';

const devices = [
	{ device_id: 'D-1', device_name: 'Sales', status: 'connected', wa_number: '62811' },
	{ device_id: 'D-2', device_name: '', status: 'disconnected', wa_number: '' },
	{ device_name: 'no id' },
];

describe('list search builders', () => {
	it('maps devices to list items and drops entries without an id', () => {
		const results = devicesToResults(devices);
		assert.deepEqual(
			results.map((r) => [r.name, r.value]),
			[
				['Sales (62811)', 'D-1'],
				['D-2', 'D-2'],
			],
		);
	});

	it('filters case-insensitively over id, name, number and status', () => {
		assert.deepEqual(
			devicesToResults(devices, 'sAlEs').map((r) => r.value),
			['D-1'],
		);
		assert.deepEqual(
			devicesToResults(devices, '62811').map((r) => r.value),
			['D-1'],
		);
		assert.deepEqual(
			devicesToResults(devices, 'disconnected').map((r) => r.value),
			['D-2'],
		);
		assert.deepEqual(devicesToResults(devices, 'nothing'), []);
	});

	it('maps WABA accounts', () => {
		const results = wabaAccountsToResults([
			{ waba_id: 'W-1', name: 'Shop', display_phone_number: '+62 811', status: 'active' },
			{ waba_id: 'W-2' },
		]);
		assert.deepEqual(
			results.map((r) => [r.name, r.value]),
			[
				['Shop (+62 811)', 'W-1'],
				['W-2', 'W-2'],
			],
		);
	});

	it('paginates only when a full page came back', () => {
		assert.equal(nextPageToken(1, DEVICES_PAGE_SIZE, DEVICES_PAGE_SIZE), '2');
		assert.equal(nextPageToken(3, DEVICES_PAGE_SIZE - 1, DEVICES_PAGE_SIZE), undefined);
	});
});

describe('list search requests', () => {
	it('searchDevices posts page and limit and returns the next page token', async () => {
		const full = Array.from({ length: DEVICES_PAGE_SIZE }, (_, i) => ({ device_id: `D-${i}` }));
		const ctx = createContext({ params: {}, respond: () => ({ data: { devices: full } }) });
		const result = await searchDevices.call(ctx as never, undefined, '2');
		assert.equal(result.results.length, DEVICES_PAGE_SIZE);
		assert.equal(result.paginationToken, '3');
		assert.deepEqual(ctx.requests[0].options.body, { page: 2, limit: DEVICES_PAGE_SIZE });
		assert.ok(ctx.requests[0].options.url?.endsWith('/v1/list-devices'));
		assert.equal(ctx.requests[0].kind, 'auth');
	});

	it('searchWabaAccounts reads data.items', async () => {
		const ctx = createContext({
			params: {},
			respond: () => ({ data: { items: [{ waba_id: 'W-1', name: 'Shop' }] } }),
		});
		const result = await searchWabaAccounts.call(ctx as never);
		assert.deepEqual(
			result.results.map((r) => r.value),
			['W-1'],
		);
	});

	it('searchWabaAccounts returns an empty list on a 404 (older servers) and rethrows other errors', async () => {
		const notFound = createContext({
			params: {},
			respond: () => {
				throw Object.assign(new Error('Not found'), { httpCode: '404' });
			},
		});
		assert.deepEqual(await searchWabaAccounts.call(notFound as never), { results: [] });

		const broken = createContext({
			params: {},
			respond: () => {
				throw Object.assign(new Error('Boom'), { httpCode: '500' });
			},
		});
		await assert.rejects(searchWabaAccounts.call(broken as never));
	});
});

describe('Kirimi node versioning', () => {
	const { properties, version, defaultVersion, usableAsTool } = new Kirimi().description;

	it('is versioned [1, 2] with usableAsTool', () => {
		assert.deepEqual(version, [1, 2]);
		assert.equal(defaultVersion, 2);
		assert.equal(usableAsTool, true);
	});

	it('keeps every device/WABA id as a plain string for version 1 and a locator for version 2', () => {
		const idNames = [
			'deviceId',
			'deviceIdV2',
			'otpWabaId',
			'wabaId',
			'webhookDeviceId',
			'webhookWabaId',
		];
		const idProps = properties.filter((p) => idNames.includes(p.name));
		assert.ok(idProps.length >= 10);
		for (const prop of idProps) {
			const versions = prop.displayOptions?.show?.['@version'];
			assert.ok(versions, `${prop.name} must be version gated`);
			if (prop.type === 'string') assert.deepEqual(versions, [1]);
			else {
				assert.equal(prop.type, 'resourceLocator');
				assert.deepEqual(versions, [2]);
				assert.deepEqual(prop.default, { mode: 'list', value: '' });
				assert.deepEqual(
					prop.modes?.map((m) => m.name),
					['list', 'id'],
				);
			}
		}
		const legacy = idProps.filter((p) => p.type === 'string').length;
		assert.equal(legacy * 2, idProps.length);
	});

	it('reads both the legacy string and the locator value', async () => {
		for (const deviceId of ['D-77', { mode: 'id', value: 'D-77' }]) {
			const ctx = createContext({
				params: { resource: 'device', operation: 'deviceStatus', deviceId },
				respond: () => ({ success: true }),
			});
			await new Kirimi().execute.call(ctx as never);
			assert.deepEqual(ctx.requests[0].options.body, { device_id: 'D-77' });
		}
	});
});
