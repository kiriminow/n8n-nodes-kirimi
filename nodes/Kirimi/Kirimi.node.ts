import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { kirimiApiRequest } from './GenericFunctions';

function splitList(value: unknown): string[] {
	if (typeof value !== 'string') {
		return Array.isArray(value) ? (value as string[]) : [];
	}
	return value
		.split(/[\s,;]+/)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function parseJson(value: unknown): unknown {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	if (typeof value === 'string') {
		return JSON.parse(value);
	}
	return value;
}

export class Kirimi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Kirimi',
		name: 'kirimi',
		icon: 'file:kirimi.svg',
		group: ['communication'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with the Kirimi WhatsApp API (Unofficial, WABA, OTP, Devices, Deposits)',
		defaults: {
			name: 'Kirimi',
		},
		inputs: ['main'] as any,
		outputs: ['main'] as any,
		credentials: [
			{
				name: 'kirimiApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Contact',
						value: 'contact',
						description: 'Contact management operations',
					},
					{
						name: 'Deposit',
						value: 'deposit',
						description: 'Deposit and balance top-up operations',
					},
					{
						name: 'Device',
						value: 'device',
						description: 'Device management operations',
					},
					{
						name: 'Message',
						value: 'message',
						description: 'Message sending operations',
					},
					{
						name: 'OTP',
						value: 'otp',
						description: 'OTP management operations',
					},
					{
						name: 'Package',
						value: 'package',
						description: 'Package and billing operations',
					},
					{
						name: 'User',
						value: 'user',
						description: 'User information operations',
					},
					{
						name: 'WABA',
						value: 'waba',
						description: 'WhatsApp Business API operations',
					},
				],
				default: 'message',
				required: true,
			},

			// ── OTP Operations ──────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['otp'],
					},
				},
				options: [
					{
						name: 'Create OTP Reverse',
						value: 'otpReverseCreate',
						description: 'Create a reverse OTP request (customer sends the code to you)',
						action: 'Create a reverse OTP',
					},
					{
						name: 'Generate OTP (V1)',
						value: 'generateOtp',
						description: 'Generate and send OTP via WhatsApp (V1 API)',
						action: 'Generate an OTP (V1)',
					},
					{
						name: 'Get OTP Reverse Status',
						value: 'otpReverseStatus',
						description: 'Check the status of a reverse OTP request',
						action: 'Get reverse OTP status',
					},
					{
						name: 'Send OTP V2 (Recommended)',
						value: 'sendOtpV2',
						description: 'Send OTP via WhatsApp (Kirimi), your own device, or your own WABA',
						action: 'Send OTP V2',
					},
					{
						name: 'Validate OTP (V1)',
						value: 'validateOtp',
						description: 'Validate OTP code (V1 API)',
						action: 'Validate an OTP (V1)',
					},
					{
						name: 'Verify OTP V2 (Recommended)',
						value: 'verifyOtpV2',
						description: 'Verify OTP code (V2 API)',
						action: 'Verify OTP V2',
					},
				],
				default: 'generateOtp',
				required: true,
			},

			// ── Message Operations ───────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Send Message',
						value: 'sendMessage',
						description: 'Send a WhatsApp message',
						action: 'Send a message',
					},
					{
						name: 'Send Message Fast',
						value: 'sendMessageFast',
						description: 'Send a WhatsApp message (fast mode, no typing effect)',
						action: 'Send a message fast',
					},
					{
						name: 'Send Message File',
						value: 'sendMessageFile',
						description: 'Send a file via multipart upload (max 50MB)',
						action: 'Send a message with file',
					},
					{
						name: 'Broadcast Message',
						value: 'broadcastMessage',
						description: 'Send a message to multiple recipients',
						action: 'Broadcast a message',
					},
				],
				default: 'sendMessage',
				required: true,
			},

			// ── Device Operations ────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['device'],
					},
				},
				options: [
					{
						name: 'Connect Device',
						value: 'connectDevice',
						description: 'Connect (start) a device so it can be paired',
						action: 'Connect a device',
					},
					{
						name: 'Create Device',
						value: 'createDevice',
						description: 'Create a new device for a package',
						action: 'Create a device',
					},
					{
						name: 'Device Status',
						value: 'deviceStatus',
						description: 'Check device connection status',
						action: 'Get device status',
					},
					{
						name: 'Device Status Enhanced',
						value: 'deviceStatusEnhanced',
						description: 'Get full detail device status',
						action: 'Get device status enhanced',
					},
					{
						name: 'List Devices',
						value: 'listDevices',
						description: 'List all devices',
						action: 'List devices',
					},
					{
						name: 'Renew Device',
						value: 'renewDevice',
						description: 'Renew a device subscription with a package',
						action: 'Renew a device',
					},
				],
				default: 'deviceStatus',
				required: true,
			},

			// ── Contact Operations ───────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['contact'],
					},
				},
				options: [
					{
						name: 'Save Contact',
						value: 'saveContact',
						description: 'Save a single contact',
						action: 'Save a contact',
					},
					{
						name: 'Save Contacts (Bulk)',
						value: 'saveContactsBulk',
						description: 'Save up to 1000 contacts in a single request',
						action: 'Save contacts in bulk',
					},
				],
				default: 'saveContact',
				required: true,
			},

			// ── Deposit Operations ───────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['deposit'],
					},
				},
				options: [
					{
						name: 'Create Deposit',
						value: 'createDeposit',
						description: 'Create a deposit and get the payment link',
						action: 'Create a deposit',
					},
					{
						name: 'Deposit Status',
						value: 'depositStatus',
						description: 'Check a deposit status by reference',
						action: 'Get deposit status',
					},
					{
						name: 'Cancel Deposit',
						value: 'cancelDeposit',
						description: 'Cancel an unpaid deposit',
						action: 'Cancel a deposit',
					},
					{
						name: 'List Deposits',
						value: 'listDeposits',
						description: 'Get deposit history',
						action: 'List deposits',
					},
				],
				default: 'createDeposit',
				required: true,
			},

			// ── Package Operations ───────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['package'],
					},
				},
				options: [
					{
						name: 'List Packages',
						value: 'listPackages',
						description: 'Get available packages',
						action: 'List packages',
					},
					{
						name: 'List Deposits (Legacy)',
						value: 'listDeposits',
						description: 'Get deposit history. Prefer the Deposit resource.',
						action: 'List deposits',
					},
				],
				default: 'listPackages',
				required: true,
			},

			// ── User Operations ──────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['user'],
					},
				},
				options: [
					{
						name: 'User Info',
						value: 'userInfo',
						description: 'Get user account information',
						action: 'Get user info',
					},
				],
				default: 'userInfo',
				required: true,
			},

			// ── WABA Operations ──────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['waba'],
					},
				},
				options: [
					{
						name: 'List Conversations',
						value: 'listConversations',
						description: 'List WABA conversations',
						action: 'List WABA conversations',
					},
					{
						name: 'Reply Message',
						value: 'replyMessage',
						description: 'Reply inside an existing conversation (text, media or interactive)',
						action: 'Reply to a WABA conversation',
					},
					{
						name: 'Send OTP',
						value: 'sendOtp',
						description: 'Send an authentication OTP via WABA template',
						action: 'Send a WABA OTP',
					},
					{
						name: 'Send Template Message',
						value: 'sendWabaMessage',
						description: 'Send an approved template message via your WABA',
						action: 'Send a WABA template message',
					},
					{
						name: 'Sync Templates',
						value: 'syncTemplates',
						description: 'Sync message templates from Meta for a WABA',
						action: 'Sync WABA templates',
					},
					{
						name: 'Verify OTP',
						value: 'verifyOtp',
						description: 'Verify an OTP sent through WABA',
						action: 'Verify a WABA OTP',
					},
				],
				default: 'sendWabaMessage',
				required: true,
			},

			// ── Shared Device ID ─────────────────────────────────────────────────────
			{
				displayName: 'Device ID',
				name: 'deviceId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['generateOtp', 'validateOtp'],
					},
				},
				default: '',
				description: 'The WhatsApp device ID to use',
			},
			{
				displayName: 'Device ID',
				name: 'deviceId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage', 'sendMessageFast', 'sendMessageFile', 'broadcastMessage'],
					},
				},
				default: '',
				description: 'The WhatsApp device ID to use',
			},
			{
				displayName: 'Device ID',
				name: 'deviceId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['device'],
						operation: ['connectDevice', 'renewDevice', 'deviceStatus', 'deviceStatusEnhanced'],
					},
				},
				default: '',
				description: 'The WhatsApp device ID to use',
			},
			{
				displayName: 'Device ID',
				name: 'deviceId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['otpReverseCreate'],
					},
				},
				default: '',
				description: 'The WhatsApp device ID that will receive the incoming OTP message',
			},

			// ── OTP V1 Fields ────────────────────────────────────────────────────────
			{
				displayName: 'Phone Number',
				name: 'phone',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['generateOtp', 'validateOtp'],
					},
				},
				default: '',
				description: 'Phone number (format: 08xxx, 62xxx, +62xxx)',
			},
			{
				displayName: 'OTP Code',
				name: 'otp',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['validateOtp'],
					},
				},
				default: '',
				description: 'The OTP code to validate',
			},
			{
				displayName: 'OTP Length',
				name: 'otpLength',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['generateOtp'],
					},
				},
				default: 8,
				description: 'Length of the OTP (4-20)',
			},
			{
				displayName: 'OTP Type',
				name: 'otpType',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['generateOtp'],
					},
				},
				options: [
					{ name: 'Numeric', value: 'numeric' },
					{ name: 'Alphabetic', value: 'alphabetic' },
					{ name: 'Alphanumeric', value: 'alphanumeric' },
				],
				default: 'numeric',
				description: 'Type of OTP to generate',
			},
			{
				displayName: 'Custom OTP Message',
				name: 'customOtpMessage',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['generateOtp'],
					},
				},
				default: '',
				description: 'Custom message template (must contain {otp})',
			},
			{
				displayName: 'Custom OTP Text',
				name: 'customOtpText',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['generateOtp'],
					},
				},
				default: '',
				description: 'Short custom prefix appended to the generated OTP text (max 20 chars)',
			},
			{
				displayName: 'Enable Typing Effect',
				name: 'enableTypingEffect',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['generateOtp'],
					},
				},
				default: false,
				description: 'Whether to simulate typing before sending the OTP message',
			},
			{
				displayName: 'Typing Speed (Ms)',
				name: 'typingSpeedMs',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['generateOtp'],
					},
				},
				default: 350,
				description: 'Typing speed in milliseconds (100-800)',
			},

			// ── OTP V2 Fields ────────────────────────────────────────────────────────
			{
				displayName: 'Phone Number',
				name: 'phoneV2',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['sendOtpV2', 'verifyOtpV2'],
					},
				},
				default: '',
				description: 'Customer phone number (format: 08xxx, 62xxx, +62xxx)',
			},
			{
				displayName: 'Send Method',
				name: 'otpMethod',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['sendOtpV2'],
					},
				},
				options: [
					{
						name: 'WhatsApp (Kirimi WABA) - Rp 595/OTP',
						value: 'whatsapp',
						description: 'Use the Kirimi WhatsApp channel (billed per delivered OTP)',
					},
					{
						name: 'Device (Own Device) - Free',
						value: 'device',
						description: 'Use your own connected device (free, customizable message)',
					},
					{
						name: 'WABA User (Own WABA) - Free',
						value: 'waba_user',
						description: 'Use your own WABA with an approved authentication template',
					},
				],
				default: 'whatsapp',
				description: 'Choose OTP sending method',
			},
			{
				displayName: 'App Name',
				name: 'appName',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['sendOtpV2'],
					},
				},
				default: 'Kirimi.id',
				description: 'Application name to show in the OTP message',
			},
			{
				displayName: 'Device ID (for Device Method)',
				name: 'deviceIdV2',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['sendOtpV2'],
						otpMethod: ['device'],
					},
				},
				default: '',
				description: 'Device ID to use for sending the OTP (required for the device method)',
			},
			{
				displayName: 'Custom Message (for Device Method)',
				name: 'customMessageV2',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['sendOtpV2'],
						otpMethod: ['device'],
					},
				},
				default: '🔐 Kode OTP {{app_name}}\n\nKode verifikasi Anda: {{otp}}\n\nBerlaku 5 menit. Jangan bagikan!',
				description: 'Custom message template. Must contain {{otp}} placeholder. Optionally use {{app_name}}.',
				placeholder: '🔐 Kode OTP {{app_name}}\n\nKode verifikasi: {{otp}}\n\nBerlaku 5 menit.',
			},
			{
				displayName: 'WABA ID (for WABA User Method)',
				name: 'otpWabaId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['sendOtpV2'],
						otpMethod: ['waba_user'],
					},
				},
				default: '',
				description: 'Your WABA ID (required for the waba_user method)',
			},
			{
				displayName: 'Template Name (for WABA User Method)',
				name: 'otpTemplateName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['sendOtpV2'],
						otpMethod: ['waba_user'],
					},
				},
				default: '',
				description: 'Approved AUTHENTICATION template name (required for the waba_user method)',
			},
			{
				displayName: 'OTP Code (V2)',
				name: 'otpCodeV2',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['verifyOtpV2'],
					},
				},
				default: '',
				description: 'The OTP code to verify',
			},

			// ── OTP Reverse Fields ───────────────────────────────────────────────────
			{
				displayName: 'Phone Number',
				name: 'reversePhone',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['otpReverseCreate'],
					},
				},
				default: '',
				description: 'The phone number the customer must send the OTP from',
			},
			{
				displayName: 'App Name',
				name: 'reverseAppName',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['otpReverseCreate'],
					},
				},
				default: 'Kirimi.id',
				description: 'Application name shown in the reverse OTP messages',
			},
			{
				displayName: 'Callback URL',
				name: 'callbackUrl',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['otpReverseCreate'],
					},
				},
				default: '',
				description: 'HTTP(S) URL called with the otp-reverse.verified event (max 500 chars)',
			},
			{
				displayName: 'Custom Message',
				name: 'reverseCustomMessage',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['otpReverseCreate'],
					},
				},
				default: '',
				description: 'Message template. Must contain {{token}} and {{phone}} (20-500 chars).',
			},
			{
				displayName: 'Success Message',
				name: 'successMessage',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['otpReverseCreate'],
					},
				},
				default: '',
				description: 'Message sent after a successful verification',
			},
			{
				displayName: 'Failure Message',
				name: 'failureMessage',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['otpReverseCreate'],
					},
				},
				default: '',
				description: 'Message sent when verification fails',
			},
			{
				displayName: 'Token',
				name: 'reverseToken',
				type: 'string',
				typeOptions: { password: true },
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['otpReverseStatus'],
					},
				},
				default: '',
				description: 'The reverse OTP token returned when the request was created',
			},

			// ── Message Fields ───────────────────────────────────────────────────────
			{
				displayName: 'Receiver',
				name: 'receiver',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage', 'sendMessageFast', 'sendMessageFile'],
					},
				},
				default: '',
				description: 'Phone number or group ID (format: 08xxx, 62xxx, +62xxx, xxxxxxxxx@g.us)',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage', 'sendMessageFast'],
					},
				},
				default: '',
				description: 'Text message (required if media URL is empty)',
			},
			{
				displayName: 'Media URL',
				name: 'mediaUrl',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage', 'sendMessageFast', 'broadcastMessage'],
					},
				},
				default: '',
				description: 'URL for media (image, video, document)',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage', 'sendMessageFast', 'broadcastMessage'],
					},
				},
				default: '',
				description: 'Custom file name for the media (optional)',
			},
			{
				displayName: 'Quoted Message ID',
				name: 'quotedMessageId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage', 'sendMessageFast', 'sendMessageFile'],
					},
				},
				default: '',
				description: 'ID of the message to quote/reply to (optional)',
			},
			{
				displayName: 'Enable Typing Effect',
				name: 'enableTypingEffect',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage', 'broadcastMessage'],
					},
				},
				default: false,
				description: 'Whether to simulate typing before sending',
			},
			{
				displayName: 'Typing Speed (Ms)',
				name: 'typingSpeedMs',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage', 'broadcastMessage'],
					},
				},
				default: 350,
				description: 'Typing speed in milliseconds (100-800)',
			},

			// ── Send Message File Fields ─────────────────────────────────────────────
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessageFile'],
					},
				},
				default: 'data',
				description: 'Name of the binary property containing the file from a previous node',
			},
			{
				displayName: 'Message',
				name: 'messageFile',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessageFile'],
					},
				},
				default: '',
				description: 'Optional caption/message to accompany the file',
			},
			{
				displayName: 'File Name Override',
				name: 'fileNameOverride',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessageFile'],
					},
				},
				default: '',
				description: 'Override the file name (optional)',
			},

			// ── Broadcast Fields ─────────────────────────────────────────────────────
			{
				displayName: 'Label',
				name: 'label',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['broadcastMessage'],
					},
				},
				default: '',
				description: 'Label for this broadcast (max 100 chars)',
			},
			{
				displayName: 'Numbers',
				name: 'numbers',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['broadcastMessage'],
					},
				},
				default: '',
				description: 'Recipient numbers separated by comma or newline (max 1000)',
				placeholder: '628111,628222,628333',
			},
			{
				displayName: 'Broadcast Message',
				name: 'message',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['broadcastMessage'],
					},
				},
				default: '',
				description: 'Text message to broadcast',
			},
			{
				displayName: 'Delay (Seconds)',
				name: 'delay',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['broadcastMessage'],
					},
				},
				default: 30,
				description: 'Delay between messages in seconds (clamped 30-3600)',
			},
			{
				displayName: 'Delay Min (Seconds)',
				name: 'delayMin',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['broadcastMessage'],
					},
				},
				default: 0,
				description: 'Minimum random delay between messages in seconds (optional)',
			},
			{
				displayName: 'Delay Max (Seconds)',
				name: 'delayMax',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['broadcastMessage'],
					},
				},
				default: 0,
				description: 'Maximum random delay between messages in seconds (optional)',
			},
			{
				displayName: 'Start At',
				name: 'startedAt',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['broadcastMessage'],
					},
				},
				default: '',
				description: 'ISO-8601 timestamp to schedule the broadcast (optional)',
			},

			// ── Contact Fields ───────────────────────────────────────────────────────
			{
				displayName: 'Name',
				name: 'nama',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['contact'],
						operation: ['saveContact'],
					},
				},
				default: '',
				description: 'Contact name',
			},
			{
				displayName: 'Number',
				name: 'nomor',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['contact'],
						operation: ['saveContact'],
					},
				},
				default: '',
				description: 'Contact phone number',
			},
			{
				displayName: 'Contacts',
				name: 'contacts',
				type: 'json',
				required: true,
				displayOptions: {
					show: {
						resource: ['contact'],
						operation: ['saveContactsBulk'],
					},
				},
				default: '[]',
				description: 'JSON array of contacts to save, e.g. [{"nama":"Budi","nomor":"628123"}] (max 1000)',
			},
			{
				displayName: 'Device ID',
				name: 'deviceId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['contact'],
						operation: ['saveContact', 'saveContactsBulk'],
					},
				},
				default: '',
				description: 'Optional device ID the contacts should be saved to',
			},

			// ── Device Fields ────────────────────────────────────────────────────────
			{
				displayName: 'Package ID',
				name: 'packageId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['device'],
						operation: ['createDevice', 'renewDevice'],
					},
				},
				default: '',
				description: 'Package ID to use for the device',
			},
			{
				displayName: 'Voucher Code',
				name: 'voucherCode',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['device'],
						operation: ['createDevice', 'renewDevice'],
					},
				},
				default: '',
				description: 'Voucher code to apply (optional)',
			},
			{
				displayName: 'Page',
				name: 'listDevicesPage',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['device'],
						operation: ['listDevices'],
					},
				},
				default: 1,
				description: 'Page number to fetch',
			},
			{
				displayName: 'Limit',
				name: 'listDevicesLimit',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['device'],
						operation: ['listDevices'],
					},
				},
				default: 10,
				description: 'Number of devices per page',
			},

			// ── Deposit Fields ───────────────────────────────────────────────────────
			{
				displayName: 'Nominal',
				name: 'nominal',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['deposit'],
						operation: ['createDeposit'],
					},
				},
				default: 10000,
				description: 'Deposit amount in IDR (minimum 100)',
			},
			{
				displayName: 'Reference',
				name: 'ref',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['deposit'],
						operation: ['depositStatus', 'cancelDeposit'],
					},
				},
				default: '',
				description: 'Deposit reference returned when the deposit was created',
			},
			{
				displayName: 'Page',
				name: 'depositPage',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['deposit'],
						operation: ['listDeposits'],
					},
				},
				default: 1,
				description: 'Page number to fetch',
			},
			{
				displayName: 'Limit',
				name: 'depositLimit',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['deposit'],
						operation: ['listDeposits'],
					},
				},
				default: 10,
				description: 'Number of deposits per page',
			},
			{
				displayName: 'Status',
				name: 'depositStatusFilter',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['deposit'],
						operation: ['listDeposits'],
					},
				},
				options: [
					{ name: 'All', value: '' },
					{ name: 'Cancelled', value: 'cancelled' },
					{ name: 'Expired', value: 'expired' },
					{ name: 'Paid', value: 'paid' },
					{ name: 'Unpaid', value: 'unpaid' },
				],
				default: '',
				description: 'Filter deposits by status (optional)',
			},

			// ── Package Fields ───────────────────────────────────────────────────────
			{
				displayName: 'Deposit Status',
				name: 'depositStatus',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['package'],
						operation: ['listDeposits'],
					},
				},
				options: [
					{ name: 'All', value: '' },
					{ name: 'Cancelled', value: 'cancelled' },
					{ name: 'Expired', value: 'expired' },
					{ name: 'Paid', value: 'paid' },
					{ name: 'Unpaid', value: 'unpaid' },
				],
				default: '',
				description: 'Filter deposits by status (optional)',
			},

			// ── WABA Fields ──────────────────────────────────────────────────────────
			{
				displayName: 'WABA ID',
				name: 'wabaId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['waba'],
						operation: [
							'sendWabaMessage',
							'replyMessage',
							'syncTemplates',
							'sendOtp',
							'verifyOtp',
						],
					},
				},
				default: '',
				description: 'Your WABA ID (never a device ID)',
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['waba'],
						operation: ['sendWabaMessage', 'replyMessage', 'sendOtp', 'verifyOtp'],
					},
				},
				default: '',
				description: 'Recipient phone number (country code, no +)',
			},
			{
				displayName: 'Template Name',
				name: 'templateName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['waba'],
						operation: ['sendWabaMessage', 'sendOtp'],
					},
				},
				default: '',
				description: 'Approved message template name',
			},
			{
				displayName: 'Variables',
				name: 'variables',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['waba'],
						operation: ['sendWabaMessage'],
					},
				},
				default: '',
				description: 'Template body variables, separated by comma or newline ({{1}}, {{2}}, ...)',
				placeholder: 'Budi,123456',
			},
			{
				displayName: 'Header',
				name: 'header',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['waba'],
						operation: ['sendWabaMessage'],
					},
				},
				default: '{}',
				description: 'Template header object, e.g. {"type":"document","link":"https://...","filename":"invoice.pdf"}',
			},
			{
				displayName: 'Buttons',
				name: 'buttons',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['waba'],
						operation: ['sendWabaMessage'],
					},
				},
				default: '[]',
				description: 'Template button parameters as a JSON array (optional)',
			},
			{
				displayName: 'Message',
				name: 'replyMessage',
				type: 'json',
				required: true,
				displayOptions: {
					show: {
						resource: ['waba'],
						operation: ['replyMessage'],
					},
				},
				default: '{"type":"text","text":""}',
				description: 'Message object. Examples: {"type":"text","text":"Hi"} · {"type":"image","media_url":"https://...","caption":"Hi"} · {"type":"interactive","interactive":{...}}.',
			},
			{
				displayName: 'Limit',
				name: 'conversationLimit',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['waba'],
						operation: ['listConversations'],
					},
				},
				default: 50,
				description: 'Number of conversations per page (1-200)',
			},
			{
				displayName: 'Page',
				name: 'conversationPage',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['waba'],
						operation: ['listConversations'],
					},
				},
				default: 1,
				description: 'Page number to fetch',
			},
			{
				displayName: 'OTP Code',
				name: 'otpCode',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['waba'],
						operation: ['verifyOtp'],
					},
				},
				default: '',
				description: 'The OTP code to verify (4-8 digits)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			const body: IDataObject = {};
			let endpoint = '';
			const method: IHttpRequestMethods = 'POST';

			// Add authentication to all requests
			const credentials = await this.getCredentials('kirimiApi');
			body.user_code = credentials.userCode;
			body.secret = credentials.secret;

			try {
				if (resource === 'otp') {
					if (operation === 'generateOtp') {
						endpoint = '/v1/generate-otp';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.phone = this.getNodeParameter('phone', i);
						const otpLength = this.getNodeParameter('otpLength', i) as number;
						if (otpLength) body.otp_length = otpLength;
						const otpType = this.getNodeParameter('otpType', i) as string;
						if (otpType) body.otp_type = otpType;
						const customOtpMessage = this.getNodeParameter('customOtpMessage', i) as string;
						if (customOtpMessage) body.customOtpMessage = customOtpMessage;
						const customOtpText = this.getNodeParameter('customOtpText', i) as string;
						if (customOtpText) body.customOtpText = customOtpText;
						const enableTypingEffect = this.getNodeParameter('enableTypingEffect', i) as boolean;
						if (enableTypingEffect) {
							body.enableTypingEffect = enableTypingEffect;
							body.typingSpeedMs = this.getNodeParameter('typingSpeedMs', i) as number;
						}
					} else if (operation === 'validateOtp') {
						endpoint = '/v1/validate-otp';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.phone = this.getNodeParameter('phone', i);
						body.otp = this.getNodeParameter('otp', i);
					} else if (operation === 'sendOtpV2') {
						endpoint = '/v2/otp/send';
						body.phone = this.getNodeParameter('phoneV2', i);
						const otpMethod = this.getNodeParameter('otpMethod', i) as string;
						body.method = otpMethod;
						const appName = this.getNodeParameter('appName', i) as string;
						if (appName) body.app_name = appName;

						if (otpMethod === 'device') {
							body.device_id = this.getNodeParameter('deviceIdV2', i);
							const customMessage = this.getNodeParameter('customMessageV2', i) as string;
							if (customMessage) body.custom_message = customMessage;
						} else if (otpMethod === 'waba_user') {
							body.waba_id = this.getNodeParameter('otpWabaId', i);
							body.template_name = this.getNodeParameter('otpTemplateName', i);
						}
					} else if (operation === 'verifyOtpV2') {
						endpoint = '/v2/otp/verify';
						body.phone = this.getNodeParameter('phoneV2', i);
						body.otp_code = this.getNodeParameter('otpCodeV2', i);
					} else if (operation === 'otpReverseCreate') {
						endpoint = '/v2/otp-reverse/create';
						body.phone = this.getNodeParameter('reversePhone', i);
						body.device_id = this.getNodeParameter('deviceId', i);
						const appName = this.getNodeParameter('reverseAppName', i) as string;
						if (appName) body.app_name = appName;
						const callbackUrl = this.getNodeParameter('callbackUrl', i) as string;
						if (callbackUrl) body.callback_url = callbackUrl;
						const customMessage = this.getNodeParameter('reverseCustomMessage', i) as string;
						if (customMessage) body.custom_message = customMessage;
						const successMessage = this.getNodeParameter('successMessage', i) as string;
						if (successMessage) body.success_message = successMessage;
						const failureMessage = this.getNodeParameter('failureMessage', i) as string;
						if (failureMessage) body.failure_message = failureMessage;
					} else if (operation === 'otpReverseStatus') {
						endpoint = '/v2/otp-reverse/status';
						body.token = this.getNodeParameter('reverseToken', i);
					}
				} else if (resource === 'message') {
					if (operation === 'sendMessage') {
						endpoint = '/v1/send-message';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.receiver = this.getNodeParameter('receiver', i);
						const message = this.getNodeParameter('message', i) as string;
						if (message) body.message = message;
						const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
						if (mediaUrl) body.media_url = mediaUrl;
						const fileName = this.getNodeParameter('fileName', i) as string;
						if (fileName) body.fileName = fileName;
						const quotedMessageId = this.getNodeParameter('quotedMessageId', i) as string;
						if (quotedMessageId) body.quotedMessageId = quotedMessageId;
						const enableTypingEffect = this.getNodeParameter('enableTypingEffect', i) as boolean;
						if (enableTypingEffect) {
							body.enableTypingEffect = enableTypingEffect;
							body.typingSpeedMs = this.getNodeParameter('typingSpeedMs', i) as number;
						}
					} else if (operation === 'sendMessageFast') {
						endpoint = '/v1/send-message-fast';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.receiver = this.getNodeParameter('receiver', i);
						const message = this.getNodeParameter('message', i) as string;
						if (message) body.message = message;
						const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
						if (mediaUrl) body.media_url = mediaUrl;
						const fileName = this.getNodeParameter('fileName', i) as string;
						if (fileName) body.fileName = fileName;
						const quotedMessageId = this.getNodeParameter('quotedMessageId', i) as string;
						if (quotedMessageId) body.quotedMessageId = quotedMessageId;
					} else if (operation === 'sendMessageFile') {
						endpoint = '/v1/send-message-file';
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
						const item = items[i];

						if (!item.binary || !item.binary[binaryPropertyName]) {
							throw new NodeOperationError(
								this.getNode(),
								`No binary data found for property "${binaryPropertyName}"`,
								{ itemIndex: i },
							);
						}

						const binaryData = item.binary[binaryPropertyName];
						const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
						const fileNameOverride = this.getNodeParameter('fileNameOverride', i) as string;
						const resolvedFileName = fileNameOverride || binaryData.fileName || 'file';
						const messageFile = this.getNodeParameter('messageFile', i) as string;
						const quotedMessageId = this.getNodeParameter('quotedMessageId', i) as string;

						const formData: IDataObject = {
							user_code: credentials.userCode as string,
							secret: credentials.secret as string,
							device_id: this.getNodeParameter('deviceId', i) as string,
							receiver: this.getNodeParameter('receiver', i) as string,
							file: {
								value: fileBuffer,
								options: {
									filename: resolvedFileName,
									contentType: binaryData.mimeType,
								},
							},
						};
						if (messageFile) {
							formData.message = messageFile;
							formData.caption = messageFile;
						}
						if (resolvedFileName) formData.fileName = resolvedFileName;
						if (quotedMessageId) formData.quotedMessageId = quotedMessageId;

						const responseData = await this.helpers.request({
							method: 'POST',
							url: `${credentials.baseUrl}${endpoint}`,
							formData,
							json: true,
						});
						returnData.push(responseData as IDataObject);
						continue;
					} else if (operation === 'broadcastMessage') {
						endpoint = '/v1/broadcast-message';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.label = this.getNodeParameter('label', i);
						body.numbers = splitList(this.getNodeParameter('numbers', i));
						body.message = this.getNodeParameter('message', i);
						const delay = this.getNodeParameter('delay', i) as number;
						if (delay) body.delay = delay;
						const delayMin = this.getNodeParameter('delayMin', i) as number;
						if (delayMin) body.delayMin = delayMin;
						const delayMax = this.getNodeParameter('delayMax', i) as number;
						if (delayMax) body.delayMax = delayMax;
						const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
						if (mediaUrl) body.media_url = mediaUrl;
						const fileName = this.getNodeParameter('fileName', i) as string;
						if (fileName) body.fileName = fileName;
						const startedAt = this.getNodeParameter('startedAt', i) as string;
						if (startedAt) body.started_at = startedAt;
						const enableTypingEffect = this.getNodeParameter('enableTypingEffect', i) as boolean;
						if (enableTypingEffect) {
							body.enableTypingEffect = enableTypingEffect;
							body.typingSpeedMs = this.getNodeParameter('typingSpeedMs', i) as number;
						}
					}
				} else if (resource === 'device') {
					if (operation === 'createDevice') {
						endpoint = '/v1/create-device';
						body.package_id = this.getNodeParameter('packageId', i);
						const voucherCode = this.getNodeParameter('voucherCode', i) as string;
						if (voucherCode) body.voucher_code = voucherCode;
					} else if (operation === 'connectDevice') {
						endpoint = '/v1/connect-device';
						body.device_id = this.getNodeParameter('deviceId', i);
					} else if (operation === 'renewDevice') {
						endpoint = '/v1/renew-device';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.package_id = this.getNodeParameter('packageId', i);
						const voucherCode = this.getNodeParameter('voucherCode', i) as string;
						if (voucherCode) body.voucher_code = voucherCode;
					} else if (operation === 'deviceStatus') {
						endpoint = '/v1/device-status';
						body.device_id = this.getNodeParameter('deviceId', i);
					} else if (operation === 'deviceStatusEnhanced') {
						endpoint = '/v1/device-status-enhanced';
						body.device_id = this.getNodeParameter('deviceId', i);
					} else if (operation === 'listDevices') {
						endpoint = '/v1/list-devices';
						body.page = this.getNodeParameter('listDevicesPage', i) as number;
						body.limit = this.getNodeParameter('listDevicesLimit', i) as number;
					}
				} else if (resource === 'contact') {
					if (operation === 'saveContact') {
						endpoint = '/v1/save-contact';
						body.nama = this.getNodeParameter('nama', i);
						body.nomor = this.getNodeParameter('nomor', i);
						const deviceId = this.getNodeParameter('deviceId', i) as string;
						if (deviceId) body.device_id = deviceId;
					} else if (operation === 'saveContactsBulk') {
						endpoint = '/v1/save-contacts-bulk';
						const contacts = parseJson(this.getNodeParameter('contacts', i));
						if (!Array.isArray(contacts) || contacts.length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'Contacts must be a non-empty JSON array of {nama, nomor} objects',
								{ itemIndex: i },
							);
						}
						body.contacts = contacts as IDataObject[];
						const deviceId = this.getNodeParameter('deviceId', i) as string;
						if (deviceId) body.device_id = deviceId;
					}
				} else if (resource === 'deposit') {
					if (operation === 'createDeposit') {
						endpoint = '/v1/create-deposit';
						body.nominal = this.getNodeParameter('nominal', i) as number;
					} else if (operation === 'depositStatus') {
						endpoint = '/v1/deposit-status';
						body.ref = this.getNodeParameter('ref', i);
					} else if (operation === 'cancelDeposit') {
						endpoint = '/v1/cancel-deposit';
						body.ref = this.getNodeParameter('ref', i);
					} else if (operation === 'listDeposits') {
						endpoint = '/v1/list-deposits';
						body.page = this.getNodeParameter('depositPage', i) as number;
						body.limit = this.getNodeParameter('depositLimit', i) as number;
						const status = this.getNodeParameter('depositStatusFilter', i) as string;
						if (status) body.status = status;
					}
				} else if (resource === 'package') {
					if (operation === 'listPackages') {
						endpoint = '/v1/list-packages';
					} else if (operation === 'listDeposits') {
						endpoint = '/v1/list-deposits';
						const depositStatus = this.getNodeParameter('depositStatus', i) as string;
						if (depositStatus) body.status = depositStatus;
					}
				} else if (resource === 'user') {
					if (operation === 'userInfo') {
						endpoint = '/v1/user-info';
					}
				} else if (resource === 'waba') {
					if (operation === 'sendWabaMessage') {
						endpoint = '/v1/waba/send-message';
						body.waba_id = this.getNodeParameter('wabaId', i);
						body.to = this.getNodeParameter('to', i);
						body.template_name = this.getNodeParameter('templateName', i);
						const variables = splitList(this.getNodeParameter('variables', i));
						if (variables.length > 0) body.variables = variables;
						const header = parseJson(this.getNodeParameter('header', i));
						if (header && Object.keys(header as IDataObject).length > 0) {
							body.header = header as IDataObject;
						}
						const buttons = parseJson(this.getNodeParameter('buttons', i));
						if (Array.isArray(buttons) && buttons.length > 0) {
							body.buttons = buttons as IDataObject[];
						}
					} else if (operation === 'replyMessage') {
						endpoint = '/v1/waba/messages/reply';
						body.waba_id = this.getNodeParameter('wabaId', i);
						body.to = this.getNodeParameter('to', i);
						body.message = parseJson(this.getNodeParameter('replyMessage', i)) as IDataObject;
					} else if (operation === 'listConversations') {
						endpoint = '/v1/waba/conversations';
						body.limit = this.getNodeParameter('conversationLimit', i) as number;
						body.page = this.getNodeParameter('conversationPage', i) as number;
					} else if (operation === 'syncTemplates') {
						endpoint = '/v1/waba/templates/sync';
						body.waba_id = this.getNodeParameter('wabaId', i);
					} else if (operation === 'sendOtp') {
						endpoint = '/v1/waba/send-otp';
						body.waba_id = this.getNodeParameter('wabaId', i);
						body.to = this.getNodeParameter('to', i);
						body.template_name = this.getNodeParameter('templateName', i);
					} else if (operation === 'verifyOtp') {
						endpoint = '/v1/waba/verify-otp';
						body.waba_id = this.getNodeParameter('wabaId', i);
						body.to = this.getNodeParameter('to', i);
						body.otp_code = this.getNodeParameter('otpCode', i);
					}
				}

				const responseData = await kirimiApiRequest.call(this, method, endpoint, body);
				returnData.push(responseData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ error: (error as Error).message });
					continue;
				}
				throw error;
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
