import type { IGetNodeParameterOptions, INodeProperties, INodePropertyMode } from 'n8n-workflow';

/** Node version that introduced the resource locators. Version 1 keeps the plain string fields. */
export const LOCATOR_VERSION = 2;
export const LEGACY_VERSIONS = [1];

type Kind = 'device' | 'waba';

const KIND_BY_PARAMETER: Record<string, Kind> = {
	deviceId: 'device',
	deviceIdV2: 'device',
	webhookDeviceId: 'device',
	wabaId: 'waba',
	otpWabaId: 'waba',
	webhookWabaId: 'waba',
};

/**
 * Resource locator modes. The extra `default` is ignored by n8n; it only keeps the n8n community
 * scanner, which checks every object that has a displayName and a type, satisfied.
 */
type LocatorMode = INodePropertyMode & { default: string };

const buildModes = (
	searchListMethod: string,
	listPlaceholder: string,
	idPlaceholder: string,
): INodePropertyMode[] => {
	const modes: LocatorMode[] = [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			default: '',
			placeholder: listPlaceholder,
			typeOptions: { searchListMethod, searchable: true },
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			default: '',
			placeholder: idPlaceholder,
		},
	];
	return modes;
};

const MODES: Record<Kind, INodePropertyMode[]> = {
	device: buildModes('searchDevices', 'Select a device...', 'D-2J3IG'),
	waba: buildModes('searchWabaAccounts', 'Select a WABA...', 'Your WABA ID'),
};

const withVersion = (
	displayOptions: INodeProperties['displayOptions'],
	versions: number[],
): INodeProperties['displayOptions'] => ({
	...displayOptions,
	show: { ...displayOptions?.show, '@version': versions },
});

/**
 * Backward compatible upgrade of ID fields to resource locators. Every string field holding a device
 * or WABA ID is kept as-is for node version 1 (saved workflows keep their value) and gets a resource
 * locator twin with the same name for node version 2 and later. Read either one with
 * getNodeParameter(name, i, '', { extractValue: true }).
 */
export const withResourceLocators = (properties: INodeProperties[]): INodeProperties[] =>
	properties.flatMap((property) => {
		const kind = KIND_BY_PARAMETER[property.name];
		if (!kind || property.type !== 'string') return [property];

		const legacy: INodeProperties = {
			...property,
			displayOptions: withVersion(property.displayOptions, LEGACY_VERSIONS),
		};
		const locator: INodeProperties = {
			...property,
			type: 'resourceLocator',
			default: { mode: 'list', value: '' },
			modes: MODES[kind],
			displayOptions: withVersion(property.displayOptions, [LOCATOR_VERSION]),
		};
		delete (locator as Partial<INodeProperties>).placeholder;
		return [legacy, locator];
	});

export const deviceLocatorProperty = (
	overrides: Pick<INodeProperties, 'displayName' | 'name' | 'displayOptions' | 'description'> &
		Partial<INodeProperties>,
): INodeProperties => ({
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	modes: MODES.device,
	...overrides,
});

export const wabaLocatorProperty = (
	overrides: Pick<INodeProperties, 'displayName' | 'name' | 'displayOptions' | 'description'> &
		Partial<INodeProperties>,
): INodeProperties => ({
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	modes: MODES.waba,
	...overrides,
});

interface HookParameters {
	getNodeParameter(name: string, fallback?: unknown, options?: IGetNodeParameterOptions): unknown;
}

interface ItemParameters {
	getNodeParameter(
		name: string,
		itemIndex: number,
		fallback?: unknown,
		options?: IGetNodeParameterOptions,
	): unknown;
}

const asId = (value: unknown): string =>
	typeof value === 'string' ? value.trim() : String(value ?? '').trim();

/**
 * Read a device or WABA ID parameter, whether it is a plain string (node version 1) or a resource
 * locator (node version 2). Pass an item index for execute(), omit it for hooks, webhooks and polls.
 */
export function readIdParameter(ctx: ItemParameters, name: string, itemIndex: number): string;
export function readIdParameter(ctx: HookParameters, name: string): string;
export function readIdParameter(
	ctx: ItemParameters | HookParameters,
	name: string,
	itemIndex?: number,
): string {
	if (itemIndex === undefined) {
		return asId((ctx as HookParameters).getNodeParameter(name, '', { extractValue: true }));
	}
	return asId(
		(ctx as ItemParameters).getNodeParameter(name, itemIndex, '', { extractValue: true }),
	);
}
