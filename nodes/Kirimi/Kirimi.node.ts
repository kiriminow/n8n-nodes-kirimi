import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import { kirimiApiRequest } from './GenericFunctions';

export class Kirimi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Kirimi',
		name: 'kirimi',
		icon: 'file:kirimi.svg',
		group: ['communication'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Kirimi WhatsApp Unofficial API',
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
						name: 'Generate OTP (V1)',
						value: 'generateOtp',
						description: 'Generate and send OTP via WhatsApp (V1 API)',
						action: 'Generate an OTP (V1)',
					},
					{
						name: 'Validate OTP (V1)',
						value: 'validateOtp',
						description: 'Validate OTP code (V1 API)',
						action: 'Validate an OTP (V1)',
					},
					{
						name: 'Send OTP V2 (Recommended)',
						value: 'sendOtpV2',
						description: 'Send OTP with dual method support (WABA or Device) - V2 API',
						action: 'Send OTP V2',
					},
					{
						name: 'Verify OTP V2 (Recommended)',
						value: 'verifyOtpV2',
						description: 'Verify OTP code - V2 API',
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
						description: 'Send message to multiple recipients',
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
				],
				default: 'saveContact',
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
						name: 'List Deposits',
						value: 'listDeposits',
						description: 'Get deposit history',
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
						name: 'Send Message',
						value: 'sendWabaMessage',
						description: 'Send a message via WhatsApp Business API (Meta Cloud API)',
						action: 'Send WABA message',
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
						resource: ['otp', 'contact'],
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
						operation: ['deviceStatus', 'deviceStatusEnhanced'],
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
						resource: ['waba'],
					},
				},
				default: '',
				description: 'The WABA device ID to use',
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
						name: 'WABA (Central) - Rp 400/OTP',
						value: 'waba',
						description: 'Use Kirimi WABA (high reliability, template-based)',
					},
					{
						name: 'Device (Own Device) - Free',
						value: 'device',
						description: 'Use your own device (free, customizable)',
					},
				],
				default: 'waba',
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
				description: 'Application name to show in OTP message',
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
				description: 'Device ID to use for sending OTP (required for device method)',
			},
			{
				displayName: 'Template Code (for WABA Method)',
				name: 'templateCode',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['sendOtpV2'],
						otpMethod: ['waba'],
					},
				},
				default: '',
				description: 'WhatsApp template code (optional)',
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

			// ── Message Fields ───────────────────────────────────────────────────────
			{
				displayName: 'Phone Number',
				name: 'phone',
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
				description: 'Text message (required if media_url is empty)',
			},
			{
				displayName: 'Media URL',
				name: 'mediaUrl',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage', 'sendMessageFast'],
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
						operation: ['sendMessage', 'sendMessageFast'],
					},
				},
				default: '',
				description: 'Custom file name for the media (optional)',
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
				displayName: 'Phone Numbers',
				name: 'phones',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['broadcastMessage'],
					},
				},
				default: '',
				description: 'Comma-separated phone numbers (e.g. 628111,628222,628333)',
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
				description: 'Delay between messages in seconds (optional)',
			},

			// ── Contact Fields ───────────────────────────────────────────────────────
			{
				displayName: 'Phone Number',
				name: 'phone',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['contact'],
						operation: ['saveContact'],
					},
				},
				default: '',
				description: 'Phone number of the contact',
			},
			{
				displayName: 'Contact Name',
				name: 'name',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['contact'],
						operation: ['saveContact'],
					},
				},
				default: '',
				description: 'Contact name (optional)',
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				displayOptions: {
					show: {
						resource: ['contact'],
						operation: ['saveContact'],
					},
				},
				default: '',
				description: 'Email address (optional)',
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
					{ name: 'Paid', value: 'paid' },
					{ name: 'Unpaid', value: 'unpaid' },
					{ name: 'Expired', value: 'expired' },
				],
				default: '',
				description: 'Filter deposits by status (optional)',
			},

			// ── WABA Fields ──────────────────────────────────────────────────────────
			{
				displayName: 'Phone Number',
				name: 'phone',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['waba'],
					},
				},
				default: '',
				description: 'Recipient phone number',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['waba'],
					},
				},
				default: '',
				description: 'Text message to send via WABA',
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
			let method: IHttpRequestMethods = 'POST';

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
					} else if (operation === 'validateOtp') {
						endpoint = '/v1/validate-otp';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.phone = this.getNodeParameter('phone', i);
						body.otp = this.getNodeParameter('otp', i);
					} else if (operation === 'sendOtpV2') {
						endpoint = '/v2/otp/send';
						body.phone = this.getNodeParameter('phoneV2', i);
						body.method = this.getNodeParameter('otpMethod', i);
						const appName = this.getNodeParameter('appName', i) as string;
						if (appName) body.app_name = appName;

						if (body.method === 'waba') {
							const templateCode = this.getNodeParameter('templateCode', i) as string;
							if (templateCode) body.template_code = templateCode;
						} else if (body.method === 'device') {
							body.device_id = this.getNodeParameter('deviceIdV2', i);
							const customMessage = this.getNodeParameter('customMessageV2', i) as string;
							if (customMessage) body.custom_message = customMessage;
						}
					} else if (operation === 'verifyOtpV2') {
						endpoint = '/v2/otp/verify';
						body.phone = this.getNodeParameter('phoneV2', i);
						body.otp_code = this.getNodeParameter('otpCodeV2', i);
					}
				} else if (resource === 'message') {
					if (operation === 'sendMessage') {
						endpoint = '/v1/send-message';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.phone = this.getNodeParameter('phone', i);
						const message = this.getNodeParameter('message', i) as string;
						if (message) body.message = message;
						const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
						if (mediaUrl) body.media_url = mediaUrl;
						const fileName = this.getNodeParameter('fileName', i) as string;
						if (fileName) body.fileName = fileName;
					} else if (operation === 'sendMessageFast') {
						endpoint = '/v1/send-message-fast';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.phone = this.getNodeParameter('phone', i);
						const message = this.getNodeParameter('message', i) as string;
						if (message) body.message = message;
						const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
						if (mediaUrl) body.media_url = mediaUrl;
						const fileName = this.getNodeParameter('fileName', i) as string;
						if (fileName) body.fileName = fileName;
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

						const formData: IDataObject = {
							user_code: credentials.userCode as string,
							secret: credentials.secret as string,
							device_id: this.getNodeParameter('deviceId', i) as string,
							phone: this.getNodeParameter('phone', i) as string,
							file: {
								value: fileBuffer,
								options: {
									filename: resolvedFileName,
									contentType: binaryData.mimeType,
								},
							},
						};
						if (messageFile) formData.message = messageFile;
						if (resolvedFileName) formData.fileName = resolvedFileName;

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
						body.phones = this.getNodeParameter('phones', i);
						body.message = this.getNodeParameter('message', i);
						const delay = this.getNodeParameter('delay', i) as number;
						if (delay) body.delay = delay;
					}
				} else if (resource === 'device') {
					if (operation === 'deviceStatus') {
						endpoint = '/v1/device-status';
						body.device_id = this.getNodeParameter('deviceId', i);
					} else if (operation === 'deviceStatusEnhanced') {
						endpoint = '/v1/device-status-enhanced';
						body.device_id = this.getNodeParameter('deviceId', i);
					} else if (operation === 'listDevices') {
						endpoint = '/v1/list-devices';
					}
				} else if (resource === 'contact') {
					if (operation === 'saveContact') {
						endpoint = '/v1/save-contact';
						body.phone = this.getNodeParameter('phone', i);
						const name = this.getNodeParameter('name', i) as string;
						if (name) body.name = name;
						const email = this.getNodeParameter('email', i) as string;
						if (email) body.email = email;
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
						body.device_id = this.getNodeParameter('deviceId', i);
						body.phone = this.getNodeParameter('phone', i);
						body.message = this.getNodeParameter('message', i);
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
