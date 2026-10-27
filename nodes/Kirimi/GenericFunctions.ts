import {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	NodeApiError,
} from 'n8n-workflow';

/**
 * Pull the Kirimi response body ({ success, data: { code }, message }) out of an error, if present.
 */
export function extractKirimiErrorBody(error: any): IDataObject | undefined {
	const candidates = [
		error?.response?.body,
		error?.response?.data,
		error?.cause?.response?.body,
		error?.cause?.response?.data,
		error?.error,
		error?.body,
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
export function wrapKirimiError(
	node: ReturnType<IExecuteFunctions['getNode']>,
	error: unknown,
): NodeApiError {
	const body = extractKirimiErrorBody(error);
	const serverMessage = typeof body?.message === 'string' ? body.message : undefined;
	const data = body?.data as IDataObject | undefined;
	const code = typeof data?.code === 'string' ? data.code : undefined;

	if (!serverMessage && !code) {
		return new NodeApiError(node, error as any);
	}

	const description = code ? `[${code}] ${serverMessage ?? ''}`.trim() : (serverMessage as string);
	return new NodeApiError(node, error as any, {
		message: serverMessage,
		description,
	});
}

export async function kirimiApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: any = {},
	query: IDataObject = {},
	headers: IDataObject = {},
): Promise<any> {
	const credentials = await this.getCredentials('kirimiApi');

	const options: IHttpRequestOptions = {
		method,
		body,
		qs: query,
		url: `${credentials.baseUrl}${endpoint}`,
		json: true,
	};

	if (Object.keys(headers).length > 0) {
		options.headers = headers;
	}

	if (Object.keys(body).length === 0) {
		delete options.body;
	}

	try {
		return await this.helpers.httpRequest.call(this, options);
	} catch (error) {
		throw wrapKirimiError(this.getNode(), error);
	}
}
