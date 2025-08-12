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
						name: 'Security',
						value: 'security',
						description: 'Security and monitoring operations',
					},
					{
						name: 'User',
						value: 'user',
						description: 'User information operations',
					},
					{
						name: 'Utility',
						value: 'utility',
						description: 'Testing and utility operations',
					},
				],
				default: 'message',
				required: true,
			},

			// OTP Operations
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
						name: 'Generate OTP',
						value: 'generateOtp',
						description: 'Generate and send OTP via WhatsApp',
						action: 'Generate an OTP',
					},
					{
						name: 'Validate OTP',
						value: 'validateOtp',
						description: 'Validate OTP code',
						action: 'Validate an OTP',
					},
				],
				default: 'generateOtp',
				required: true,
			},

			// Message Operations
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
						description: 'Send a WhatsApp message (fast mode)',
						action: 'Send a message fast',
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

			// Device Operations
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
						description: 'Connect WhatsApp device',
						action: 'Connect a device',
					},
					{
						name: 'Create Device',
						value: 'createDevice',
						description: 'Create a new WhatsApp device',
						action: 'Create a device',
					},
					{
						name: 'Device Status',
						value: 'deviceStatus',
						description: 'Check device status',
						action: 'Get device status',
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
						description: 'Renew device subscription',
						action: 'Renew a device',
					},
				],
				default: 'deviceStatus',
				required: true,
			},

			// Contact Operations
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
						name: 'Save Contacts Bulk',
						value: 'saveContactsBulk',
						description: 'Save multiple contacts',
						action: 'Save contacts in bulk',
					},
				],
				default: 'saveContact',
				required: true,
			},

			// Package Operations
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
						name: 'Create Deposit',
						value: 'createDeposit',
						description: 'Create a deposit for top-up',
						action: 'Create a deposit',
					},
					{
						name: 'Deposit Status',
						value: 'depositStatus',
						description: 'Check deposit status',
						action: 'Get deposit status',
					},
				],
				default: 'listPackages',
				required: true,
			},

			// User Operations
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
						description: 'Get user information',
						action: 'Get user info',
					},
				],
				default: 'userInfo',
				required: true,
			},

			// Security Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['security'],
					},
				},
				options: [
					{
						name: 'OTP Security Status',
						value: 'otpSecurityStatus',
						description: 'Check OTP security status',
						action: 'Get OTP security status',
					},
					{
						name: 'Merchant Reputation',
						value: 'merchantReputation',
						description: 'Check merchant reputation',
						action: 'Get merchant reputation',
					},
					{
						name: 'Customer OTP Stats',
						value: 'customerOtpStats',
						description: 'Get customer OTP statistics',
						action: 'Get customer OTP stats',
					},
				],
				default: 'otpSecurityStatus',
				required: true,
			},

			// Utility Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['utility'],
					},
				},
				options: [
					{
						name: 'Test Phone Normalization',
						value: 'testPhoneNormalization',
						description: 'Test phone number normalization',
						action: 'Test phone normalization',
					},
				],
				default: 'testPhoneNormalization',
				required: true,
			},

			// Device ID field (required for most operations)
			{
				displayName: 'Device ID',
				name: 'deviceId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp', 'message', 'contact'],
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
						operation: ['connectDevice', 'deviceStatus', 'renewDevice'],
					},
				},
				default: '',
				description: 'The WhatsApp device ID to use',
			},

			// OTP Fields
			{
				displayName: 'Phone Number',
				name: 'phone',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['otp'],
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
				displayName: 'Enable Typing Effect',
				name: 'enableTypingEffect',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['generateOtp'],
					},
				},
				default: true,
				description: 'Whether to enable typing effect',
			},
			{
				displayName: 'Typing Speed (Ms)',
				name: 'typingSpeedMs',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['otp'],
						operation: ['generateOtp'],
						enableTypingEffect: [true],
					},
				},
				default: 50,
				description: 'Typing speed in milliseconds',
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
					{
						name: 'Numeric',
						value: 'numeric',
					},
					{
						name: 'Alphabetic',
						value: 'alphabetic',
					},
					{
						name: 'Alphanumeric',
						value: 'alphanumeric',
					},
				],
				default: 'numeric',
				description: 'Type of OTP to generate',
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
				description: 'Custom OTP text (optional)',
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

			// Message Fields
			{
				displayName: 'Receiver',
				name: 'receiver',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage', 'sendMessageFast'],
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
			{
				displayName: 'Enable Typing Effect',
				name: 'enableTypingEffect',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage'],
					},
				},
				default: true,
				description: 'Whether to enable typing effect',
			},
			{
				displayName: 'Typing Speed (Ms)',
				name: 'typingSpeedMs',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMessage'],
						enableTypingEffect: [true],
					},
				},
				default: 50,
				description: 'Typing speed in milliseconds',
			},

			// Broadcast Fields
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
				description: 'Label for the broadcast',
			},
			{
				displayName: 'Phone Numbers',
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
				description: 'Comma-separated phone numbers (max 500 for free, 2000 for premium)',
			},
			{
				displayName: 'Broadcast Message',
				name: 'message',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['broadcastMessage'],
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
						operation: ['broadcastMessage'],
					},
				},
				default: '',
				description: 'URL for media (image, video, document)',
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
				description: 'Delay between messages in seconds (minimum 30)',
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
				default: '',
				description: 'Minimum delay (optional)',
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
				default: '',
				description: 'Maximum delay (optional)',
			},
			{
				displayName: 'Start Time',
				name: 'startedAt',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['broadcastMessage'],
					},
				},
				default: '',
				description: 'When to start the broadcast (optional)',
			},

			// Device Fields
			{
				displayName: 'Package ID',
				name: 'packageId',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['device'],
						operation: ['createDevice', 'renewDevice'],
					},
				},
				default: 1,
				description: 'Package ID for the device',
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
				description: 'Voucher code (optional)',
			},

			// Contact Fields
			{
				displayName: 'Contact Name',
				name: 'name',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['contact'],
						operation: ['saveContact'],
					},
				},
				default: '',
			},
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
			{
				displayName: 'Company',
				name: 'company',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['contact'],
						operation: ['saveContact'],
					},
				},
				default: '',
				description: 'Company name (optional)',
			},
			{
				displayName: 'Contacts',
				name: 'contacts',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['contact'],
						operation: ['saveContactsBulk'],
					},
				},
				default: '',
				description: 'JSON array of contacts with name, phone, email, company fields',
			},

			// Package Fields
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['package'],
						operation: ['createDeposit'],
					},
				},
				default: 1,
				description: 'Deposit amount',
			},
			{
				displayName: 'Payment Method',
				name: 'paymentMethod',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['package'],
						operation: ['createDeposit'],
					},
				},
				default: '',
			},
			{
				displayName: 'Deposit ID',
				name: 'depositId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['package'],
						operation: ['depositStatus'],
					},
				},
				default: '',
				description: 'Deposit ID to check status',
			},

			// Utility Fields
			{
				displayName: 'Phone Number',
				name: 'phone',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['utility'],
						operation: ['testPhoneNormalization'],
					},
				},
				default: '',
				description: 'Phone number to normalize',
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
						endpoint = '/generate-otp';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.phone = this.getNodeParameter('phone', i);
						body.enableTypingEffect = this.getNodeParameter('enableTypingEffect', i);
						body.typingSpeedMs = this.getNodeParameter('typingSpeedMs', i);
						body.otpLength = this.getNodeParameter('otpLength', i);
						body.otpType = this.getNodeParameter('otpType', i);
						const customOtpText = this.getNodeParameter('customOtpText', i) as string;
						if (customOtpText) body.customOtpText = customOtpText;
						const customOtpMessage = this.getNodeParameter('customOtpMessage', i) as string;
						if (customOtpMessage) body.customOtpMessage = customOtpMessage;
					} else if (operation === 'validateOtp') {
						endpoint = '/validate-otp';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.phone = this.getNodeParameter('phone', i);
						body.otp = this.getNodeParameter('otp', i);
					}
				} else if (resource === 'message') {
					if (operation === 'sendMessage') {
					endpoint = '/send-message';
					body.device_id = this.getNodeParameter('deviceId', i);
					body.receiver = this.getNodeParameter('receiver', i);
					const message = this.getNodeParameter('message', i) as string;
					if (message) body.message = message;
					const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
					if (mediaUrl) body.media_url = mediaUrl;
					const fileName = this.getNodeParameter('fileName', i) as string;
					if (fileName) body.fileName = fileName;
					body.enableTypingEffect = this.getNodeParameter('enableTypingEffect', i);
					body.typingSpeedMs = this.getNodeParameter('typingSpeedMs', i);
					} else if (operation === 'sendMessageFast') {
					endpoint = '/send-message-fast';
					body.device_id = this.getNodeParameter('deviceId', i);
					body.receiver = this.getNodeParameter('receiver', i);
					const message = this.getNodeParameter('message', i) as string;
					if (message) body.message = message;
					const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
					if (mediaUrl) body.media_url = mediaUrl;
					const fileName = this.getNodeParameter('fileName', i) as string;
					if (fileName) body.fileName = fileName;
					} else if (operation === 'broadcastMessage') {
						endpoint = '/broadcast-message';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.label = this.getNodeParameter('label', i);
						const numbersString = this.getNodeParameter('numbers', i) as string;
						body.numbers = numbersString.split(',').map((num: string) => num.trim());
						const message = this.getNodeParameter('message', i) as string;
						if (message) body.message = message;
						const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
						if (mediaUrl) body.media_url = mediaUrl;
						body.delay = this.getNodeParameter('delay', i);
						const delayMin = this.getNodeParameter('delayMin', i) as number;
						if (delayMin) body.delayMin = delayMin;
						const delayMax = this.getNodeParameter('delayMax', i) as number;
						if (delayMax) body.delayMax = delayMax;
						const startedAt = this.getNodeParameter('startedAt', i) as string;
						if (startedAt) body.started_at = startedAt;
					}
				} else if (resource === 'device') {
					if (operation === 'createDevice') {
						endpoint = '/create-device';
						body.package_id = this.getNodeParameter('packageId', i);
						const voucherCode = this.getNodeParameter('voucherCode', i) as string;
						if (voucherCode) body.voucher_code = voucherCode;
					} else if (operation === 'connectDevice') {
						endpoint = '/connect-device';
						body.device_id = this.getNodeParameter('deviceId', i);
					} else if (operation === 'deviceStatus') {
						endpoint = '/device-status';
						body.device_id = this.getNodeParameter('deviceId', i);
					} else if (operation === 'listDevices') {
						endpoint = '/list-devices';
					} else if (operation === 'renewDevice') {
						endpoint = '/renew-device';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.package_id = this.getNodeParameter('packageId', i);
						const voucherCode = this.getNodeParameter('voucherCode', i) as string;
						if (voucherCode) body.voucher_code = voucherCode;
					}
				} else if (resource === 'contact') {
					if (operation === 'saveContact') {
						endpoint = '/save-contact';
						body.device_id = this.getNodeParameter('deviceId', i);
						body.name = this.getNodeParameter('name', i);
						body.phone = this.getNodeParameter('phone', i);
						const email = this.getNodeParameter('email', i) as string;
						if (email) body.email = email;
						const company = this.getNodeParameter('company', i) as string;
						if (company) body.company = company;
					} else if (operation === 'saveContactsBulk') {
						endpoint = '/save-contacts-bulk';
						body.device_id = this.getNodeParameter('deviceId', i);
						const contactsString = this.getNodeParameter('contacts', i) as string;
						try {
							body.contacts = JSON.parse(contactsString);
						} catch (error) {
							throw new NodeOperationError(this.getNode(), 'Invalid JSON format for contacts');
						}
					}
				} else if (resource === 'package') {
					if (operation === 'listPackages') {
						endpoint = '/list-packages';
					} else if (operation === 'createDeposit') {
						endpoint = '/create-deposit';
						body.amount = this.getNodeParameter('amount', i);
						body.payment_method = this.getNodeParameter('paymentMethod', i);
					} else if (operation === 'depositStatus') {
						endpoint = '/deposit-status';
						body.deposit_id = this.getNodeParameter('depositId', i);
					}
				} else if (resource === 'user') {
					if (operation === 'userInfo') {
						endpoint = '/user-info';
					}
				} else if (resource === 'security') {
					if (operation === 'otpSecurityStatus') {
						endpoint = '/otp-security-status';
					} else if (operation === 'merchantReputation') {
						endpoint = '/merchant-reputation';
					} else if (operation === 'customerOtpStats') {
						endpoint = '/customer-otp-stats';
					}
				} else if (resource === 'utility') {
					if (operation === 'testPhoneNormalization') {
						endpoint = '/test-phone-normalization';
						body.phone = this.getNodeParameter('phone', i);
						// Remove auth fields for this endpoint
						delete body.user_code;
						delete body.secret;
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