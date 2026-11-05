import type {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	INodePropertyOptions,
} from 'n8n-workflow';

import { deviceEventOptions, wabaEventOptions } from './events';
import {
	COLLECTION_VERSION,
	LEGACY_VERSIONS,
	LOCATOR_VERSION,
	deviceLocatorProperty,
} from './locators';

/** Versions that keep the optional parameters as top-level fields. */
const FLAT_VERSIONS = [...LEGACY_VERSIONS, LOCATOR_VERSION];

interface FlatRule {
	resource: string;
	operations: string[];
	names: string[];
}

const SEND_OPERATIONS = ['sendMessage', 'sendMessageFast', 'sendMessageFile'];

/** Top-level optional fields that node version 3 moved into the Additional Fields / Filters collections. */
const FLAT_RULES: FlatRule[] = [
	{
		resource: 'otp',
		operations: ['generateOtp'],
		names: [
			'otpLength',
			'otpType',
			'customOtpMessage',
			'customOtpText',
			'enableTypingEffect',
			'typingSpeedMs',
		],
	},
	{ resource: 'otp', operations: ['sendOtpV2'], names: ['appName', 'customMessageV2'] },
	{
		resource: 'otp',
		operations: ['otpReverseCreate'],
		names: [
			'reverseAppName',
			'callbackUrl',
			'reverseCustomMessage',
			'successMessage',
			'failureMessage',
		],
	},
	{
		resource: 'message',
		operations: [...SEND_OPERATIONS, 'broadcastMessage'],
		names: [
			'mediaUrl',
			'fileName',
			'fileNameOverride',
			'quotedMessageId',
			'enableTypingEffect',
			'typingSpeedMs',
			'clientMsgId',
			'autoClientMsgId',
			'delay',
			'delayMin',
			'delayMax',
			'startedAt',
		],
	},
	{ resource: 'webhook', operations: ['subscribe'], names: ['webhookLabel'] },
	{
		resource: 'webhook',
		operations: ['listEvents'],
		names: ['webhookEventFilterDevice', 'webhookEventFilterWaba'],
	},
	{ resource: 'contact', operations: ['saveContact', 'saveContactsBulk'], names: ['deviceId'] },
	{ resource: 'device', operations: ['createDevice', 'renewDevice'], names: ['voucherCode'] },
	{
		resource: 'device',
		operations: ['listDevices'],
		names: ['listDevicesPage', 'listDevicesLimit'],
	},
	{
		resource: 'deposit',
		operations: ['listDeposits'],
		names: ['depositStatusFilter', 'depositPage', 'depositLimit'],
	},
	{
		resource: 'waba',
		operations: ['listConversations'],
		names: ['conversationPage', 'conversationLimit'],
	},
	{ resource: 'waba', operations: ['sendWabaMessage'], names: ['variables', 'header', 'buttons'] },
];

const asList = (value: unknown): string[] => (Array.isArray(value) ? (value as string[]) : []);

const matchesRule = (property: INodeProperties, rule: FlatRule): boolean => {
	const show = property.displayOptions?.show;
	if (!show || !rule.names.includes(property.name)) return false;
	if (!asList(show.resource).includes(rule.resource)) return false;
	return asList(show.operation).some((operation) => rule.operations.includes(operation));
};

/**
 * Gate the optional top-level fields that moved into collections in node version 3 to the older node
 * versions, so saved workflows keep their parameters. Run it before withResourceLocators.
 */
export const gateFlatFields = (properties: INodeProperties[]): INodeProperties[] =>
	properties.map((property) =>
		FLAT_RULES.some((rule) => matchesRule(property, rule))
			? {
					...property,
					displayOptions: {
						...property.displayOptions,
						show: { ...property.displayOptions?.show, '@version': FLAT_VERSIONS },
					},
				}
			: property,
	);

const v3 = (
	resource: string,
	operations: string[],
	extra: Record<string, Array<string | boolean | number>> = {},
): INodeProperties['displayOptions'] => ({
	show: { resource: [resource], operation: operations, '@version': [COLLECTION_VERSION], ...extra },
});

const additionalFields = (
	resource: string,
	operations: string[],
	options: INodeProperties[],
): INodeProperties => ({
	displayName: 'Additional Fields',
	name: 'additionalFields',
	type: 'collection',
	placeholder: 'Add Field',
	default: {},
	displayOptions: v3(resource, operations),
	options,
});

const filters = (
	resource: string,
	operations: string[],
	options: INodeProperties[],
	extra: Record<string, Array<string | boolean | number>> = {},
): INodeProperties => ({
	displayName: 'Filters',
	name: 'filters',
	type: 'collection',
	placeholder: 'Add Filter',
	default: {},
	displayOptions: v3(resource, operations, extra),
	options,
});

const clientMsgIdOptions = (): INodeProperties[] => [
	{
		displayName: 'Auto-Generate Client Message ID',
		name: 'autoClientMsgId',
		type: 'boolean',
		default: false,
		description:
			'Whether to derive a stable Client Message ID from the execution ID, the node name and the item index when none is given. A retried execution of the same item then reuses the same key, so the message is never sent twice. The key used is added to the output as clientMsgId.',
	},
	{
		displayName: 'Client Message ID',
		name: 'clientMsgId',
		type: 'string',
		default: '',
		description:
			'Idempotency key, 1-128 characters of [A-Za-z0-9._:-]. Retries with the same key within 24 hours never send the message twice. Use it with Get Message Status.',
	},
];

const typingEffectOption = (description: string): INodeProperties => ({
	displayName: 'Enable Typing Effect',
	name: 'enableTypingEffect',
	type: 'boolean',
	default: false,
	description,
});

const typingSpeedOption: INodeProperties = {
	displayName: 'Typing Speed (Ms)',
	name: 'typingSpeedMs',
	type: 'number',
	default: 350,
	description:
		'Typing speed in milliseconds (100-800). Only used when the typing effect is enabled.',
};

const mediaUrlOption = (description: string): INodeProperties => ({
	displayName: 'Media URL',
	name: 'mediaUrl',
	type: 'string',
	default: '',
	description,
});

const fileNameOption: INodeProperties = {
	displayName: 'File Name',
	name: 'fileName',
	type: 'string',
	default: '',
	description: 'Custom file name for the media (optional)',
};

const quotedMessageIdOption: INodeProperties = {
	displayName: 'Quoted Message ID',
	name: 'quotedMessageId',
	type: 'string',
	default: '',
	description: 'ID of the message to quote/reply to (optional)',
};

const voucherCodeOption: INodeProperties = {
	displayName: 'Voucher Code',
	name: 'voucherCode',
	type: 'string',
	default: '',
	description: 'Voucher code to apply (optional)',
};

const returnAllAndLimit = (resource: string, operation: string): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: v3(resource, [operation]),
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		displayOptions: v3(resource, [operation], { returnAll: [false] }),
		default: 50,
		description: 'Max number of results to return',
	},
];

const statusOptions: INodePropertyOptions[] = [
	{ name: 'All', value: '' },
	{ name: 'Cancelled', value: 'cancelled' },
	{ name: 'Expired', value: 'expired' },
	{ name: 'Paid', value: 'paid' },
	{ name: 'Unpaid', value: 'unpaid' },
];

/** Node version 3 parameters: Return All + Limit for list operations and one collection per operation. */
export const collectionProperties = (): INodeProperties[] => [
	...returnAllAndLimit('device', 'listDevices'),
	...returnAllAndLimit('deposit', 'listDeposits'),
	...returnAllAndLimit('waba', 'listConversations'),

	additionalFields(
		'otp',
		['generateOtp'],
		[
			{
				displayName: 'Custom OTP Message',
				name: 'customOtpMessage',
				type: 'string',
				default: '',
				description: 'Custom message template (must contain {otp})',
			},
			{
				displayName: 'Custom OTP Text',
				name: 'customOtpText',
				type: 'string',
				default: '',
				description: 'Short custom prefix appended to the generated OTP text (max 20 chars)',
			},
			typingEffectOption('Whether to simulate typing before sending the OTP message'),
			{
				displayName: 'OTP Length',
				name: 'otpLength',
				type: 'number',
				default: 8,
				description: 'Length of the OTP (4-20)',
			},
			{
				displayName: 'OTP Type',
				name: 'otpType',
				type: 'options',
				options: [
					{ name: 'Alphabetic', value: 'alphabetic' },
					{ name: 'Alphanumeric', value: 'alphanumeric' },
					{ name: 'Numeric', value: 'numeric' },
				],
				default: 'numeric',
				description: 'Type of OTP to generate',
			},
			typingSpeedOption,
		],
	),
	additionalFields(
		'otp',
		['sendOtpV2'],
		[
			{
				displayName: 'App Name',
				name: 'appName',
				type: 'string',
				default: 'Kirimi.id',
				description: 'Application name to show in the OTP message',
			},
			{
				displayName: 'Custom Message (for Device Method)',
				name: 'customMessageV2',
				type: 'string',
				displayOptions: { show: { '/otpMethod': ['device'] } },
				default:
					'🔐 OTP {{app_name}}\n\nYour verification code: {{otp}}\n\nValid for 5 minutes. Do not share!',
				description:
					'Custom message template. Must contain {{otp}} placeholder. Optionally use {{app_name}}.',
				placeholder:
					'🔐 OTP {{app_name}}\n\nYour verification code: {{otp}}\n\nValid for 5 minutes.',
			},
		],
	),
	additionalFields(
		'otp',
		['otpReverseCreate'],
		[
			{
				displayName: 'App Name',
				name: 'reverseAppName',
				type: 'string',
				default: 'Kirimi.id',
				description: 'Application name shown in the reverse OTP messages',
			},
			{
				displayName: 'Callback URL',
				name: 'callbackUrl',
				type: 'string',
				default: '',
				description: 'HTTP(S) URL called with the otp-reverse.verified event (max 500 chars)',
			},
			{
				displayName: 'Custom Message',
				name: 'reverseCustomMessage',
				type: 'string',
				default: '',
				description: 'Message template. Must contain {{token}} and {{phone}} (20-500 chars).',
			},
			{
				displayName: 'Failure Message',
				name: 'failureMessage',
				type: 'string',
				default: '',
				description: 'Message sent when verification fails',
			},
			{
				displayName: 'Success Message',
				name: 'successMessage',
				type: 'string',
				default: '',
				description: 'Message sent after a successful verification',
			},
		],
	),

	additionalFields(
		'message',
		['sendMessage'],
		[
			...clientMsgIdOptions(),
			typingEffectOption('Whether to simulate typing before sending'),
			fileNameOption,
			mediaUrlOption('URL for media (image, video, document)'),
			quotedMessageIdOption,
			typingSpeedOption,
		],
	),
	additionalFields(
		'message',
		['sendMessageFast'],
		[
			...clientMsgIdOptions(),
			fileNameOption,
			mediaUrlOption('URL for media (image, video, document)'),
			quotedMessageIdOption,
		],
	),
	additionalFields(
		'message',
		['sendMessageFile'],
		[
			...clientMsgIdOptions(),
			{
				displayName: 'File Name Override',
				name: 'fileNameOverride',
				type: 'string',
				default: '',
				description: 'Override the file name (optional)',
			},
			quotedMessageIdOption,
		],
	),
	additionalFields(
		'message',
		['broadcastMessage'],
		[
			{
				displayName: 'Delay (Seconds)',
				name: 'delay',
				type: 'number',
				default: 30,
				description:
					'Delay between messages in seconds (clamped to 30-3600). Max 10 broadcasts per hour.',
			},
			{
				displayName: 'Delay Max (Seconds)',
				name: 'delayMax',
				type: 'number',
				default: 0,
				description: 'Maximum random delay between messages in seconds (optional)',
			},
			{
				displayName: 'Delay Min (Seconds)',
				name: 'delayMin',
				type: 'number',
				default: 0,
				description: 'Minimum random delay between messages in seconds (optional)',
			},
			mediaUrlOption(
				'URL for media (image, video, document). The message becomes optional when a media URL is given.',
			),
			{
				displayName: 'Start At',
				name: 'startedAt',
				type: 'string',
				default: '',
				description: 'ISO-8601 timestamp to schedule the broadcast (optional)',
			},
		],
	),

	additionalFields(
		'webhook',
		['subscribe'],
		[
			{
				displayName: 'Label',
				name: 'label',
				type: 'string',
				default: '',
				description: 'Optional label for this subscription (max 100 chars)',
			},
		],
	),
	filters(
		'webhook',
		['listEvents'],
		[
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: deviceEventOptions(),
				default: [],
				description: 'Only return these events (empty = all events)',
			},
		],
		{ webhookScope: ['device'] },
	),
	filters(
		'webhook',
		['listEvents'],
		[
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: wabaEventOptions(),
				default: [],
				description: 'Only return these events (empty = all events)',
			},
		],
		{ webhookScope: ['waba'] },
	),

	additionalFields(
		'contact',
		['saveContact', 'saveContactsBulk'],
		[
			deviceLocatorProperty({
				displayName: 'Device',
				name: 'deviceId',
				description: 'Optional device the contacts should be saved to',
			}),
		],
	),

	additionalFields('device', ['createDevice', 'renewDevice'], [voucherCodeOption]),
	filters(
		'deposit',
		['listDeposits'],
		[
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: statusOptions,
				default: '',
				description: 'Filter deposits by status (optional)',
			},
		],
	),
	additionalFields(
		'waba',
		['sendWabaMessage'],
		[
			{
				displayName: 'Buttons',
				name: 'buttons',
				type: 'json',
				default: '[]',
				description: 'Template button parameters as a JSON array (optional)',
			},
			{
				displayName: 'Header',
				name: 'header',
				type: 'json',
				default: '{}',
				description:
					'Template header object, e.g. {"type":"document","link":"https://...","filename":"invoice.pdf"}',
			},
			{
				displayName: 'Variables',
				name: 'variables',
				type: 'string',
				default: '',
				description: 'Template body variables, separated by comma or newline ({{1}}, {{2}}, ...)',
				placeholder: 'Budi,123456',
			},
		],
	),
];

/** True when the running node is version 3 or later. */
export const isCollectionVersion = (ctx: Pick<IExecuteFunctions, 'getNode'>): boolean =>
	ctx.getNode().typeVersion >= COLLECTION_VERSION;

/**
 * Reader for one optional parameter of an item. Node version 1 and 2 read the top-level field
 * `legacyName`; version 3 reads `name` from the operation's collection.
 */
export const optionReader =
	(ctx: IExecuteFunctions, itemIndex: number, collection = 'additionalFields') =>
	<T>(legacyName: string, name: string, fallback: T): T => {
		if (!isCollectionVersion(ctx)) {
			return ctx.getNodeParameter(legacyName, itemIndex, fallback) as T;
		}
		const values = ctx.getNodeParameter(collection, itemIndex, {}) as IDataObject;
		return (values[name] ?? fallback) as T;
	};
