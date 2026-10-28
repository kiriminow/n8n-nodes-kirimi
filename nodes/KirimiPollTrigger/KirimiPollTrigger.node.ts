import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodeListSearchResult,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

import { asNodeError, isGone, isNotFound, kirimiApiRequest } from '../Kirimi/GenericFunctions';
import { MAX_SUBSCRIPTION_EVENTS, deviceEventOptions, wabaEventOptions } from '../Kirimi/events';
import { searchDevices, searchWabaAccounts } from '../Kirimi/listSearch';
import { deviceLocatorProperty, readIdParameter, wabaLocatorProperty } from '../Kirimi/locators';
import {
	POLL_FETCH_LIMIT,
	initialPollState,
	selectNewEvents,
	type PollEvent,
	type PollState,
} from './pollCursor';

const sortedKey = (events: string[]): string => [...new Set(events)].sort().join(',');

interface PollConfig {
	scope: string;
	scopeId: string;
	scopeKey: 'waba_id' | 'device_id';
	events: string[];
}

const getConfig = (ctx: IPollFunctions): PollConfig => {
	const scope = ctx.getNodeParameter('scope') as string;
	const scopeId = readIdParameter(ctx, scope === 'waba' ? 'wabaId' : 'deviceId');
	const events = ctx.getNodeParameter(scope === 'waba' ? 'wabaEvents' : 'deviceEvents') as string[];
	return { scope, scopeId, scopeKey: scope === 'waba' ? 'waba_id' : 'device_id', events };
};

const clearSubscription = (staticData: IDataObject): void => {
	delete staticData.pollSubscriptionId;
	delete staticData.pollScope;
	delete staticData.pollScopeId;
	delete staticData.pollEventsKey;
};

const unsubscribeQuietly = async (ctx: IPollFunctions, id: string): Promise<void> => {
	try {
		await kirimiApiRequest.call(ctx, 'POST', '/v1/webhook/unsubscribe', { id });
	} catch (error) {
		if (!isNotFound(error)) throw asNodeError(ctx.getNode(), error);
	}
};

/**
 * Make sure a poll-mode subscription exists for the configured scope and events. The subscription id,
 * scope and events are kept in the node's static data; a changed scope or event list replaces it.
 * Returns true when the scope changed, so the caller resets its cursor.
 */
const ensureSubscription = async (
	ctx: IPollFunctions,
	config: PollConfig,
	staticData: IDataObject,
): Promise<boolean> => {
	const eventsKey = sortedKey(config.events);
	const existingId = staticData.pollSubscriptionId as string | undefined;
	const scopeChanged =
		staticData.pollScope !== config.scope || staticData.pollScopeId !== config.scopeId;

	if (existingId && !scopeChanged && staticData.pollEventsKey === eventsKey) {
		return false;
	}
	if (existingId) {
		await unsubscribeQuietly(ctx, existingId);
		clearSubscription(staticData);
	}

	const workflow = ctx.getWorkflow();
	const label = `n8n poll: ${workflow.name || workflow.id || ''}`.slice(0, 100);
	// No target_url: the server only records the events and does not deliver them.
	const response = await kirimiApiRequest.call(ctx, 'POST', '/v1/webhook/subscribe', {
		[config.scopeKey]: config.scopeId,
		events: config.events,
		delivery: 'poll',
		label,
	});
	const id = (response?.data as IDataObject | undefined)?.id ?? response?.id;
	if (!id) {
		throw new NodeOperationError(ctx.getNode(), 'Kirimi did not return a subscription id');
	}
	staticData.pollSubscriptionId = id as string;
	staticData.pollScope = config.scope;
	staticData.pollScopeId = config.scopeId;
	staticData.pollEventsKey = eventsKey;
	return scopeChanged;
};

const fetchEvents = async (ctx: IPollFunctions, config: PollConfig): Promise<PollEvent[]> => {
	const response = await kirimiApiRequest.call(ctx, 'POST', '/v1/webhook/events', {
		[config.scopeKey]: config.scopeId,
		events: config.events,
		limit: POLL_FETCH_LIMIT,
	});
	return ((response?.data as IDataObject | undefined)?.items ?? []) as PollEvent[];
};

export class KirimiPollTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Kirimi Polling Trigger',
		name: 'kirimiPollTrigger',
		icon: { light: 'file:kirimi.svg', dark: 'file:kirimi.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["scope"] === "waba" ? "WABA events" : "Device events"}}',
		description:
			'Poll Kirimi WhatsApp events. For n8n instances without a public https URL (use Kirimi Trigger otherwise)',
		defaults: {
			name: 'Kirimi Polling Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'kirimiApi',
				required: true,
			},
		],
		properties: [
			{
				displayName:
					'Kirimi records the selected events for this workflow and the node fetches them on every poll. Deactivating the workflow does not delete the recording: remove it with the Kirimi node (Webhook Subscription > Unsubscribe) when it is no longer needed.',
				name: 'pollNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Scope',
				name: 'scope',
				type: 'options',
				options: [
					{ name: 'Device (QR)', value: 'device' },
					{ name: 'WABA', value: 'waba' },
				],
				default: 'device',
				description: 'Whether to listen on a QR device or on a WABA',
			},
			deviceLocatorProperty({
				displayName: 'Device',
				name: 'deviceId',
				required: true,
				displayOptions: { show: { scope: ['device'] } },
				description: 'The WhatsApp device to listen to',
			}),
			wabaLocatorProperty({
				displayName: 'WABA',
				name: 'wabaId',
				required: true,
				displayOptions: { show: { scope: ['waba'] } },
				description: 'The WABA to listen to',
			}),
			{
				displayName: 'Events',
				name: 'deviceEvents',
				type: 'multiOptions',
				required: true,
				displayOptions: { show: { scope: ['device'] } },
				options: deviceEventOptions(),
				default: ['message'],
				description: 'The events to listen to (1-20)',
			},
			{
				displayName: 'Events',
				name: 'wabaEvents',
				type: 'multiOptions',
				required: true,
				displayOptions: { show: { scope: ['waba'] } },
				options: wabaEventOptions(),
				default: ['message'],
				description: 'The events to listen to (1-20)',
			},
		],
	};

	methods = {
		listSearch: {
			async searchDevices(
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				return await searchDevices.call(this, filter, paginationToken);
			},
			async searchWabaAccounts(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				return await searchWabaAccounts.call(this, filter);
			},
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const config = getConfig(this);
		if (!config.scopeId) {
			throw new NodeOperationError(
				this.getNode(),
				config.scope === 'waba' ? 'WABA is required' : 'Device is required',
			);
		}
		if (config.events.length < 1 || config.events.length > MAX_SUBSCRIPTION_EVENTS) {
			throw new NodeOperationError(
				this.getNode(),
				`Select between 1 and ${MAX_SUBSCRIPTION_EVENTS} events`,
			);
		}

		const staticData = this.getWorkflowStaticData('node');
		const scopeChanged = await ensureSubscription(this, config, staticData);
		if (scopeChanged) delete staticData.pollState;

		let items: PollEvent[];
		try {
			items = await fetchEvents(this, config);
		} catch (error) {
			// The subscription was removed server-side: re-create it on the next poll.
			if (isGone(error)) clearSubscription(staticData);
			throw asNodeError(this.getNode(), error);
		}

		// Manual execution (Fetch Test Event): return the latest event without moving the cursor.
		if (this.getMode() === 'manual') {
			return items.length > 0 ? [this.helpers.returnJsonArray([items[0] as IDataObject])] : null;
		}

		const state = (staticData.pollState as PollState | undefined) ?? initialPollState();
		const selection = selectNewEvents(items, state);
		staticData.pollState = selection.state as unknown as IDataObject;

		if (selection.emit.length === 0) return null;
		return [this.helpers.returnJsonArray(selection.emit as IDataObject[])];
	}
}
