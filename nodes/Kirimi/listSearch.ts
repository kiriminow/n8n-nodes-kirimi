import type { IDataObject, ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import { assigneesFromResponse } from './conversation';
import { asNodeError, isNotFound, kirimiApiRequest } from './GenericFunctions';

export const DEVICES_PAGE_SIZE = 50;

export interface KirimiDevice {
	device_id?: string;
	device_name?: string;
	status?: string;
	wa_number?: string;
}

export interface KirimiWabaAccount {
	waba_id?: string;
	name?: string;
	display_phone_number?: string;
	phone_number_id?: string;
	status?: string;
}

const matches = (filter: string | undefined, ...haystack: Array<string | undefined>): boolean => {
	const needle = (filter ?? '').trim().toLowerCase();
	if (!needle) return true;
	return haystack.some((value) => (value ?? '').toLowerCase().includes(needle));
};

const label = (primary: string | undefined, secondary: string | undefined, fallback: string) => {
	const name = primary || fallback;
	return secondary ? `${name} (${secondary})` : name;
};

export const devicesToResults = (
	devices: KirimiDevice[],
	filter?: string,
): INodeListSearchResult['results'] =>
	devices
		.filter((device) => device.device_id)
		.filter((device) =>
			matches(filter, device.device_id, device.device_name, device.wa_number, device.status),
		)
		.map((device) => ({
			name: label(device.device_name, device.wa_number, device.device_id as string),
			value: device.device_id as string,
			description: [device.device_id, device.status].filter(Boolean).join(' - '),
		}));

export const wabaAccountsToResults = (
	accounts: KirimiWabaAccount[],
	filter?: string,
): INodeListSearchResult['results'] =>
	accounts
		.filter((account) => account.waba_id)
		.filter((account) =>
			matches(
				filter,
				account.waba_id,
				account.name,
				account.display_phone_number,
				account.phone_number_id,
				account.status,
			),
		)
		.map((account) => ({
			name: label(account.name, account.display_phone_number, account.waba_id as string),
			value: account.waba_id as string,
			description: [account.waba_id, account.status].filter(Boolean).join(' - '),
		}));

export interface KirimiTeamAssignee {
	team_id?: number | string;
	name?: string;
	email?: string;
}

/** Team seats as "Name (email)" with the numeric team_id as value. */
export const assigneesToResults = (
	assignees: KirimiTeamAssignee[],
	filter?: string,
): INodeListSearchResult['results'] =>
	assignees
		.filter((assignee) => assignee.team_id !== undefined && assignee.team_id !== null)
		.filter((assignee) => matches(filter, assignee.name, assignee.email, String(assignee.team_id)))
		.map((assignee) => ({
			name: label(assignee.name, assignee.email, String(assignee.team_id)),
			value: String(assignee.team_id),
			description: assignee.email,
		}));

/** WABA phone numbers keyed by phone_number_id, which is the device_id of WABA conversations. */
export const wabaNumbersToResults = (
	accounts: KirimiWabaAccount[],
	filter?: string,
): INodeListSearchResult['results'] =>
	accounts
		.filter((account) => account.phone_number_id)
		.filter((account) =>
			matches(
				filter,
				account.phone_number_id,
				account.name,
				account.display_phone_number,
				account.waba_id,
			),
		)
		.map((account) => ({
			name: label(
				account.display_phone_number || account.name,
				account.name && account.display_phone_number ? account.name : undefined,
				account.phone_number_id as string,
			),
			value: account.phone_number_id as string,
			description: [account.phone_number_id, account.status].filter(Boolean).join(' - '),
		}));

/** Next-page token: a full page means there may be more. */
export const nextPageToken = (page: number, received: number, limit: number): string | undefined =>
	received >= limit ? String(page + 1) : undefined;

export async function searchDevices(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const page = Number(paginationToken) > 0 ? Number(paginationToken) : 1;
	const response = await kirimiApiRequest.call(this, 'POST', '/v1/list-devices', {
		page,
		limit: DEVICES_PAGE_SIZE,
	});
	const devices = ((response?.data as IDataObject | undefined)?.devices ?? []) as KirimiDevice[];
	return {
		results: devicesToResults(devices, filter),
		paginationToken: nextPageToken(page, devices.length, DEVICES_PAGE_SIZE),
	};
}

/** Older servers do not have /v1/waba/accounts yet: a 404 yields an empty list instead of an error. */
export async function searchWabaAccounts(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	try {
		const response = await kirimiApiRequest.call(this, 'POST', '/v1/waba/accounts', {});
		const accounts = ((response?.data as IDataObject | undefined)?.items ??
			[]) as KirimiWabaAccount[];
		return { results: wabaAccountsToResults(accounts, filter) };
	} catch (error) {
		if (isNotFound(error)) return { results: [] };
		throw asNodeError(this.getNode(), error);
	}
}

export async function searchWabaNumbers(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	try {
		const response = await kirimiApiRequest.call(this, 'POST', '/v1/waba/accounts', {});
		const accounts = ((response?.data as IDataObject | undefined)?.items ??
			[]) as KirimiWabaAccount[];
		return { results: wabaNumbersToResults(accounts, filter) };
	} catch (error) {
		if (isNotFound(error)) return { results: [] };
		throw asNodeError(this.getNode(), error);
	}
}

/** Older servers do not have /v1/team/assignees yet: a 404 yields an empty list instead of an error. */
export async function searchTeamAssignees(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	try {
		const response = await kirimiApiRequest.call(this, 'POST', '/v1/team/assignees', {});
		return { results: assigneesToResults(assigneesFromResponse(response), filter) };
	} catch (error) {
		if (isNotFound(error)) return { results: [] };
		throw asNodeError(this.getNode(), error);
	}
}
