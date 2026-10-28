import { INodePropertyOptions } from 'n8n-workflow';

export const DEVICE_EVENTS: string[] = [
	'message',
	'message.outgoing',
	'message.history',
	'message.sent',
	'message.failed',
	'message.ack',
	'message.reaction',
	'message.deleted',
	'message.edited',
	'connection.connected',
	'connection.disconnected',
	'logged_out',
	'qr',
	'group.join',
	'group.leave',
	'group.update',
	'presence.update',
	'call.offer',
	'device.created',
	'device.connected',
	'device.status_changed',
	'device.last_active',
	'device.reconnected',
];

export const WABA_EVENTS: string[] = [
	'message',
	'message.sent',
	'message.ack',
	'message.failed',
	'template.status_update',
	'template.quality_update',
	'account.review_update',
	'account.alerts',
	'account.banned',
	'phone_number.quality_update',
	'message.echo',
];

export const MAX_SUBSCRIPTION_EVENTS = 20;

const DEVICE_LABELS: Record<string, string> = {
	message: 'Message (Incoming)',
	'message.outgoing': 'Message Outgoing',
	'message.history': 'Message History',
	'message.sent': 'Message Sent',
	'message.failed': 'Message Failed',
	'message.ack': 'Message Ack (WABA Only — Not Sent for QR Devices)',
	'message.reaction': 'Message Reaction',
	'message.deleted': 'Message Deleted',
	'message.edited': 'Message Edited',
	'connection.connected': 'Connection Connected',
	'connection.disconnected': 'Connection Disconnected',
	logged_out: 'Logged Out',
	qr: 'QR Code',
	'group.join': 'Group Join',
	'group.leave': 'Group Leave',
	'group.update': 'Group Update',
	'presence.update': 'Presence Update (Not Delivered Yet)',
	'call.offer': 'Call Offer',
	'device.created': 'Device Created',
	'device.connected': 'Device Connected',
	'device.status_changed': 'Device Status Changed',
	'device.last_active': 'Device Last Active',
	'device.reconnected': 'Device Reconnected',
};

const WABA_LABELS: Record<string, string> = {
	message: 'Message (Incoming)',
	'message.sent': 'Message Sent',
	'message.ack': 'Message Ack',
	'message.failed': 'Message Failed',
	'template.status_update': 'Template Status Update',
	'template.quality_update': 'Template Quality Update',
	'account.review_update': 'Account Review Update',
	'account.alerts': 'Account Alerts',
	'account.banned': 'Account Banned',
	'phone_number.quality_update': 'Phone Number Quality Update',
	'message.echo': 'Message Echo (Coexistence)',
};

const toOptions = (events: string[], labels: Record<string, string>): INodePropertyOptions[] =>
	events.map((value) => ({ name: labels[value] ?? value, value }));

export const deviceEventOptions = (): INodePropertyOptions[] =>
	toOptions(DEVICE_EVENTS, DEVICE_LABELS);

export const wabaEventOptions = (): INodePropertyOptions[] => toOptions(WABA_EVENTS, WABA_LABELS);

/** Union of device and WABA events; WABA-only ones are labelled "(WABA)". */
export const allEventOptions = (): INodePropertyOptions[] => {
	const deviceSet = new Set(DEVICE_EVENTS);
	const wabaOnly = WABA_EVENTS.filter((value) => !deviceSet.has(value)).map((value) => ({
		name: `${WABA_LABELS[value]} (WABA)`,
		value,
	}));
	return [...deviceEventOptions(), ...wabaOnly];
};
