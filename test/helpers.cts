import type { IDataObject, INode } from 'n8n-workflow';

export interface RecordedRequest {
	kind: 'auth' | 'plain';
	options: {
		method?: string;
		url?: string;
		body?: unknown;
		headers?: Record<string, string>;
		qs?: unknown;
	};
}

export interface MockOptions {
	params: Record<string, unknown>;
	items?: Array<{ json: IDataObject; binary?: Record<string, unknown> }>;
	/** Return value of every API call, or a function of the request. */
	respond?: (request: RecordedRequest) => unknown;
	executionId?: string;
	nodeName?: string;
	runIndex?: number;
	mode?: 'manual' | 'trigger' | 'internal';
	staticData?: IDataObject;
	binaryBuffer?: Buffer;
}

export const CREDENTIALS = {
	userCode: 'USER1',
	secret: 'SECRET1',
	baseUrl: 'https://api.example.test/',
};

const resolveParam = (
	params: Record<string, unknown>,
	name: string,
	fallback: unknown,
	extractValue: boolean,
): unknown => {
	if (!(name in params)) return fallback;
	const value = params[name];
	if (extractValue && value && typeof value === 'object' && 'value' in (value as object)) {
		return (value as { value: unknown }).value;
	}
	return value;
};

/** Minimal stand-in for the n8n execution context, enough to run node code in unit tests. */
export const createContext = (options: MockOptions) => {
	const requests: RecordedRequest[] = [];
	const staticData: IDataObject = options.staticData ?? {};
	const node = { name: options.nodeName ?? 'Kirimi', type: 'kirimi', typeVersion: 2 } as INode;

	const record =
		(kind: RecordedRequest['kind']) =>
		async (...args: unknown[]) => {
			// helpers are invoked with .call(ctx, ...): after `call`, args are the real arguments
			const requestOptions = (kind === 'auth' ? args[1] : args[0]) as RecordedRequest['options'];
			const request: RecordedRequest = { kind, options: requestOptions };
			requests.push(request);
			return options.respond ? options.respond(request) : { success: true };
		};

	const getNodeParameter = (...args: unknown[]) => {
		// execute(): (name, itemIndex, fallback, opts); hooks/poll: (name, fallback, opts)
		const hasItemIndex = typeof args[1] === 'number';
		const name = args[0] as string;
		const fallback = hasItemIndex ? args[2] : args[1];
		const opts = (hasItemIndex ? args[3] : args[2]) as { extractValue?: boolean } | undefined;
		return resolveParam(options.params, name, fallback, Boolean(opts?.extractValue));
	};

	const ctx = {
		requests,
		staticData,
		getNode: () => node,
		getNodeParameter,
		getCredentials: async () => CREDENTIALS,
		getInputData: () => options.items ?? [{ json: {} }],
		getExecutionId: () => options.executionId ?? 'exec-1',
		getExecuteData: () => ({ runIndex: options.runIndex ?? 0 }),
		getMode: () => options.mode ?? 'trigger',
		getWorkflow: () => ({ id: 'wf1', name: 'My Workflow' }),
		getWorkflowStaticData: () => staticData,
		continueOnFail: () => false,
		helpers: {
			httpRequestWithAuthentication: record('auth'),
			httpRequest: record('plain'),
			getBinaryDataBuffer: async () => options.binaryBuffer ?? Buffer.from('hello'),
			returnJsonArray: (data: IDataObject[]) => data.map((json) => ({ json })),
		},
	};
	return ctx;
};
