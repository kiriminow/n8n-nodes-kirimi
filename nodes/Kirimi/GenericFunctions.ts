import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHookFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type ILoadOptionsFunctions,
	type INode,
	type IPollFunctions,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';

export interface KirimiResponse {
	success?: boolean;
	message?: string;
	id?: string;
	data?: IDataObject;
	[key: string]: unknown;
}

const dig = (value: unknown, ...path: string[]): unknown =>
	path.reduce<unknown>(
		(current, key) =>
			current && typeof current === 'object'
				? (current as Record<string, unknown>)[key]
				: undefined,
		value,
	);

/**
 * Pull the Kirimi response body ({ success, data: { code }, message }) out of an error, if present.
 */
export function extractKirimiErrorBody(error: unknown): IDataObject | undefined {
	const candidates = [
		dig(error, 'response', 'body'),
		dig(error, 'response', 'data'),
		dig(error, 'cause', 'response', 'body'),
		dig(error, 'cause', 'response', 'data'),
		dig(error, 'error'),
		dig(error, 'body'),
	];
	for (const candidate of candidates) {
		if (candidate && typeof candidate === 'object') return candidate as IDataObject;
		if (typeof candidate === 'string' && candidate.trim().startsWith('{')) {
			try {
				return JSON.parse(candidate) as IDataObject;
			} catch {
				// not JSON, try next candidate
			}
		}
	}
	return undefined;
}

/**
 * Wrap an error in NodeApiError and surface the server `message` and `data.code`
 * (e.g. IDEMPOTENCY_IN_PROGRESS, DELIVERY_UNKNOWN, USE_WABA_ENDPOINT) in the description.
 */
export function wrapKirimiError(node: INode, error: unknown): NodeApiError {
	const body = extractKirimiErrorBody(error);
	const serverMessage = typeof body?.message === 'string' ? body.message : undefined;
	const data = body?.data as IDataObject | undefined;
	const code = typeof data?.code === 'string' ? data.code : undefined;

	if (!serverMessage && !code) {
		return new NodeApiError(node, error as JsonObject);
	}

	const description = code ? `[${code}] ${serverMessage ?? ''}`.trim() : (serverMessage as string);
	// Newer n8n versions already throw a NodeApiError from the request helpers, and the NodeApiError
	// constructor returns such an instance untouched, ignoring the options: patch it in place.
	if (error instanceof NodeApiError) {
		error.description = description;
		if (serverMessage) error.message = serverMessage;
		return error;
	}
	return new NodeApiError(node, error as JsonObject, {
		message: serverMessage,
		description,
	});
}

/** Pass node errors through unchanged and wrap anything else, so callers never re-throw a raw error. */
export function asNodeError(node: INode, error: unknown): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) return error;
	return wrapKirimiError(node, error);
}

export type KirimiRequestContext =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IHookFunctions
	| IWebhookFunctions
	| IPollFunctions;

const statusOf = (error: unknown): string =>
	String(
		dig(error, 'httpCode') ??
			dig(error, 'statusCode') ??
			dig(error, 'response', 'status') ??
			dig(error, 'cause', 'response', 'status') ??
			'',
	);

/** True when an error (raw or wrapped in NodeApiError) carries an HTTP 404 status. */
export const isNotFound = (error: unknown): boolean => statusOf(error) === '404';

/** True for 404 and 410 (resource missing or revoked server-side). */
export const isGone = (error: unknown): boolean => ['404', '410'].includes(statusOf(error));

export const trimBaseUrl = (baseUrl: unknown): string => String(baseUrl ?? '').replace(/\/+$/, '');

/**
 * JSON request to the Kirimi API. Authentication (user_code + secret in the body) is applied by the
 * credential's `authenticate` definition through httpRequestWithAuthentication.
 */
export async function kirimiApiRequest(
	this: KirimiRequestContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	query: IDataObject = {},
	headers: IDataObject = {},
): Promise<KirimiResponse> {
	const credentials = await this.getCredentials('kirimiApi');

	const options: IHttpRequestOptions = {
		method,
		body,
		qs: query,
		url: `${trimBaseUrl(credentials.baseUrl)}${endpoint}`,
		json: true,
	};

	if (Object.keys(headers).length > 0) {
		options.headers = headers;
	}

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'kirimiApi',
			options,
		)) as KirimiResponse;
	} catch (error) {
		throw wrapKirimiError(this.getNode(), error);
	}
}

/**
 * Multipart request. The generic credential `authenticate` merges JSON properties into the body and
 * does not apply to a raw multipart payload, so the caller must put user_code and secret into the
 * form fields itself (see buildMultipartBody).
 */
export async function kirimiMultipartRequest(
	this: KirimiRequestContext,
	endpoint: string,
	body: Buffer,
	contentType: string,
): Promise<KirimiResponse> {
	const credentials = await this.getCredentials('kirimiApi');
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${trimBaseUrl(credentials.baseUrl)}${endpoint}`,
		body,
		headers: { 'Content-Type': contentType },
		json: true,
	};
	try {
		return (await this.helpers.httpRequest.call(this, options)) as KirimiResponse;
	} catch (error) {
		throw wrapKirimiError(this.getNode(), error);
	}
}

/** Largest page the paging helper requests. The server caps list endpoints at 100-200 per page. */
export const PAGE_SIZE = 100;

const arrayAt = (value: unknown, path: string): IDataObject[] => {
	const found = path
		.split('.')
		.reduce<unknown>(
			(current, key) =>
				current && typeof current === 'object'
					? (current as Record<string, unknown>)[key]
					: undefined,
			value,
		);
	return Array.isArray(found) ? (found as IDataObject[]) : [];
};

/**
 * Collect the records of a paginated list endpoint. Sends `page` and `limit` in the body, reads the
 * records from `itemsPath` (dot path inside the response, e.g. `data.devices`) and stops on a short or
 * empty page, or as soon as `limit` records are collected. Without `limit` every page is fetched.
 */
export async function kirimiApiRequestAllItems(
	this: KirimiRequestContext,
	endpoint: string,
	body: IDataObject,
	itemsPath: string,
	limit?: number,
): Promise<IDataObject[]> {
	const pageSize = limit === undefined ? PAGE_SIZE : Math.max(1, Math.min(limit, PAGE_SIZE));
	const collected: IDataObject[] = [];
	for (let page = 1; ; page++) {
		const response = await kirimiApiRequest.call(this, 'POST', endpoint, {
			...body,
			page,
			limit: pageSize,
		});
		const records = arrayAt(response, itemsPath);
		collected.push(...records);
		if (records.length < pageSize) break;
		if (limit !== undefined && collected.length >= limit) break;
	}
	return limit === undefined ? collected : collected.slice(0, limit);
}
