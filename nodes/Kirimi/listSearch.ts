import type { IDataObject, ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

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
