import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	CONVERSATION_ENDPOINTS,
	MAX_NOTE_LENGTH,
	assigneeBody,
	assigneesFromResponse,
	buildHandoffBody,
	buildReleaseBody,
	buildStatusBody,
	normalizePhone,
	readAssignee,
	unwrapData,
	validateIdentity,
} from '../nodes/Kirimi/conversation';
import { CONVERSATION_FIELD_EVENTS, DEVICE_EVENTS, WABA_EVENTS } from '../nodes/Kirimi/events';
import { Kirimi } from '../nodes/Kirimi/Kirimi.node';
import {
	assigneesToResults,
	searchTeamAssignees,
	wabaNumbersToResults,
} from '../nodes/Kirimi/listSearch';
import { createContext } from './helpers.cjs';

const identity = { deviceId: 'D-2J3IG', phone: '0812-3456 789' };

describe('conversation helpers', () => {
	it('normalizes phone numbers', () => {
		assert.equal(normalizePhone('08123456789'), '628123456789');
		assert.equal(normalizePhone('+62 812-3456-789'), '628123456789');
		assert.equal(normalizePhone('628123456789@s.whatsapp.net'), '628123456789');
		assert.equal(normalizePhone(undefined), '');
	});

	it('validates device and phone', () => {
		assert.equal(validateIdentity(identity), undefined);
		assert.match(validateIdentity({ deviceId: ' ', phone: '08' }) ?? '', /Device/);
		assert.match(validateIdentity({ deviceId: 'D-1', phone: ' + ' }) ?? '', /Phone/);
	});

	it('reads assignee locators and builds the assignee body', () => {
		assert.deepEqual(assigneeBody(readAssignee({ mode: 'list', value: '12' })), {
			assignee_team_id: 12,
		});
		assert.deepEqual(assigneeBody(readAssignee({ mode: 'id', value: ' 7 ' })), {
			assignee_team_id: 7,
		});
		assert.deepEqual(assigneeBody(readAssignee({ mode: 'email', value: 'CS@Example.com ' })), {
			assignee_email: 'cs@example.com',
		});
		assert.deepEqual(assigneeBody(readAssignee({ mode: 'list', value: '' })), {});
		assert.deepEqual(assigneeBody(readAssignee('')), {});
		assert.throws(() => assigneeBody(readAssignee({ mode: 'id', value: 'abc' })), /team ID/);
	});

	it('builds handoff, release and status bodies', () => {
		assert.deepEqual(buildHandoffBody(identity, readAssignee(''), ''), {
			device_id: 'D-2J3IG',
			phone: '628123456789',
		});
		assert.deepEqual(
			buildHandoffBody(identity, readAssignee({ mode: 'email', value: 'a@b.co' }), ' needs human '),
			{
				device_id: 'D-2J3IG',
				phone: '628123456789',
				assignee_email: 'a@b.co',
				note: 'needs human',
			},
		);
		assert.deepEqual(buildReleaseBody(identity, 'done'), {
			device_id: 'D-2J3IG',
			phone: '628123456789',
			note: 'done',
		});
		assert.deepEqual(buildReleaseBody(identity, '', true), {
			device_id: 'D-2J3IG',
			phone: '628123456789',
			force: true,
		});
		assert.equal('force' in buildReleaseBody(identity, '', false), false);
		assert.deepEqual(buildStatusBody(identity), { device_id: 'D-2J3IG', phone: '628123456789' });
		assert.throws(
			() => buildReleaseBody(identity, 'x'.repeat(MAX_NOTE_LENGTH + 1)),
			/at most 1000/,
		);
	});

	it('unwraps responses', () => {
		assert.deepEqual(unwrapData({ success: true, data: { exists: true } }), { exists: true });
		assert.deepEqual(unwrapData({ success: true }), { success: true });
		assert.deepEqual(
			assigneesFromResponse({ data: [{ team_id: 1, name: 'A', email: 'a@x.co' }] }),
			[{ team_id: 1, name: 'A', email: 'a@x.co' }],
		);
		assert.deepEqual(assigneesFromResponse({ data: { items: [{ team_id: 2 }] } }), [
			{ team_id: 2 },
		]);
		assert.deepEqual(assigneesFromResponse({ data: null }), []);
	});

	it('documents the conversation field on message events of both channels', () => {
		assert.deepEqual(CONVERSATION_FIELD_EVENTS, ['message']);
		for (const event of CONVERSATION_FIELD_EVENTS) {
			assert.ok(DEVICE_EVENTS.includes(event));
			assert.ok(WABA_EVENTS.includes(event));
		}
	});
});

describe('conversation pickers', () => {
	it('lists assignees as name (email) with the team id as value', () => {
		const seats = [
			{ team_id: 1, name: 'Ani', email: 'ani@x.co' },
			{ team_id: 2, name: '', email: 'bob@x.co' },
			{ name: 'no id' },
		];
		assert.deepEqual(
			assigneesToResults(seats).map((r) => [r.name, r.value]),
			[
				['Ani (ani@x.co)', '1'],
				['2 (bob@x.co)', '2'],
			],
		);
		assert.deepEqual(
			assigneesToResults(seats, 'BOB').map((r) => r.value),
			['2'],
		);
	});

	it('lists WABA numbers by phone_number_id and skips accounts without one', () => {
		const results = wabaNumbersToResults([
			{ waba_id: 'W-1', name: 'Shop', display_phone_number: '+62 811', phone_number_id: '555' },
			{ waba_id: 'W-2', name: 'No number' },
		]);
		assert.deepEqual(
			results.map((r) => r.value),
			['555'],
		);
	});

	it('searchTeamAssignees posts to /v1/team/assignees and tolerates a 404', async () => {
		const ctx = createContext({
			params: {},
			respond: () => ({ data: [{ team_id: 5, name: 'Ani', email: 'ani@x.co' }] }),
		});
		const result = await searchTeamAssignees.call(ctx as never);
		assert.deepEqual(
			result.results.map((r) => r.value),
			['5'],
		);
		assert.ok(ctx.requests[0].options.url?.endsWith('/v1/team/assignees'));
		const missing = createContext({
			params: {},
			respond: () => {
				throw Object.assign(new Error('Not found'), { httpCode: '404' });
			},
		});
		assert.deepEqual(await searchTeamAssignees.call(missing as never), { results: [] });
	});
});

const run = async (params: Record<string, unknown>, response: unknown) => {
	const ctx = createContext({ params, respond: () => response, typeVersion: 3 });
	const out = await new Kirimi().execute.call(ctx as never);
	return { ctx, items: out[0].map((item) => item.json) };
};

describe('Kirimi node: conversation resource', () => {
	it('exposes the resource and its four operations', () => {
		const props = new Kirimi().description.properties;
		const resource = props.find((p) => p.name === 'resource');
		assert.ok(resource?.options?.some((o) => 'value' in o && o.value === 'conversation'));
		const ops = props.find(
			(p) => p.name === 'operation' && p.displayOptions?.show?.resource?.[0] === 'conversation',
		);
		assert.deepEqual(
			ops?.options?.map((o) => 'value' in o && o.value),
			['getStatus', 'handoff', 'listAssignees', 'release'],
		);
	});

	it('handoff sends device, normalized phone, assignee and note', async () => {
		const { ctx, items } = await run(
			{
				resource: 'conversation',
				operation: 'handoff',
				conversationChannel: 'device',
				conversationDeviceId: { mode: 'list', value: 'D-2J3IG' },
				conversationPhone: '08123456789',
				conversationAssignee: { mode: 'email', value: 'cs@x.co' },
				conversationNote: 'wants a human',
			},
			{ success: true, data: { human_handling: true, already: false } },
		);
		assert.ok(ctx.requests[0].options.url?.endsWith(CONVERSATION_ENDPOINTS.handoff));
		assert.deepEqual(ctx.requests[0].options.body, {
			device_id: 'D-2J3IG',
			phone: '628123456789',
			assignee_email: 'cs@x.co',
			note: 'wants a human',
		});
		assert.deepEqual(items, [{ human_handling: true, already: false }]);
	});

	it('uses the WABA phone number id for the WABA channel', async () => {
		const { ctx } = await run(
			{
				resource: 'conversation',
				operation: 'getStatus',
				conversationChannel: 'waba',
				conversationWabaNumberId: { mode: 'id', value: '555000' },
				conversationPhone: '+628123456789',
			},
			{ success: true, data: { exists: false } },
		);
		assert.ok(ctx.requests[0].options.url?.endsWith('/v1/conversations/status'));
		assert.deepEqual(ctx.requests[0].options.body, {
			device_id: '555000',
			phone: '628123456789',
		});
	});

	it('release posts the note; list assignees returns one item per seat', async () => {
		const release = await run(
			{
				resource: 'conversation',
				operation: 'release',
				conversationDeviceId: { mode: 'id', value: 'D-1' },
				conversationPhone: '628111',
				conversationNote: 'bot again',
			},
			{ success: true, data: { human_handling: false, already: false } },
		);
		assert.ok(release.ctx.requests[0].options.url?.endsWith('/v1/conversations/release'));
		assert.deepEqual(release.ctx.requests[0].options.body, {
			device_id: 'D-1',
			phone: '628111',
			note: 'bot again',
		});

		const list = await run(
			{ resource: 'conversation', operation: 'listAssignees' },
			{
				success: true,
				data: [
					{ team_id: 1, name: 'A', email: 'a@x.co' },
					{ team_id: 2, name: 'B', email: 'b@x.co' },
				],
			},
		);
		assert.ok(list.ctx.requests[0].options.url?.endsWith('/v1/team/assignees'));
		assert.equal(list.items.length, 2);
	});

	it('rejects a missing device before any request', async () => {
		const ctx = createContext({
			params: {
				resource: 'conversation',
				operation: 'getStatus',
				conversationDeviceId: { mode: 'list', value: '' },
				conversationPhone: '628111',
			},
			typeVersion: 3,
		});
		await assert.rejects(new Kirimi().execute.call(ctx as never), /Device is required/);
		assert.equal(ctx.requests.length, 0);
	});
});
