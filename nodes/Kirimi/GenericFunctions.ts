import { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-core';
import { IDataObject, IHttpRequestMethods, IHttpRequestOptions, NodeApiError } from 'n8n-workflow';

export async function kirimiApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: any = {},
	query: IDataObject = {},
): Promise<any> {
	const credentials = await this.getCredentials('kirimiApi');

	const options: IHttpRequestOptions = {
		method,
		body,
		qs: query,
		url: `${credentials.baseUrl}${endpoint}`,
		json: true,
	};

	if (Object.keys(body).length === 0) {
		delete options.body;
	}

	try {
		return await this.helpers.httpRequest.call(this, options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error);
	}
}