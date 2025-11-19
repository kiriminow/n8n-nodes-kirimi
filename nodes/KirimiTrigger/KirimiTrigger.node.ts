import {
    IHookFunctions,
    IWebhookFunctions,
    IDataObject,
    INodeType,
    INodeTypeDescription,
    IWebhookResponseData,
} from 'n8n-workflow';

export class KirimiTrigger implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Kirimi Trigger',
        name: 'kirimiTrigger',
        icon: 'file:kirimi.svg',
        group: ['trigger'],
        version: 1,
        subtitle: '={{$parameter["events"].join(", ")}}',
        description: 'Handle Kirimi WhatsApp webhook events',
        defaults: {
            name: 'Kirimi Trigger',
        },
        inputs: [],
        outputs: ['main'] as any,
        credentials: [],
        webhooks: [
            {
                name: 'default',
                httpMethod: 'POST',
                responseMode: 'onReceived',
                path: 'webhook',
            },
        ],
        properties: [
            {
                displayName: 'Events',
                name: 'events',
                type: 'multiOptions',
                options: [
                    {
                        name: 'Message (Incoming)',
                        value: 'message',
                        description: 'Triggered when a new message is received',
                    },
                    {
                        name: 'Message Sent',
                        value: 'message.sent',
                        description: 'Triggered when a message is successfully sent',
                    },
                    {
                        name: 'Message Failed',
                        value: 'message.failed',
                        description: 'Triggered when a message fails to send',
                    },
                    {
                        name: 'Message ACK',
                        value: 'message.ack',
                        description: 'Triggered when message status changes (delivered, read, etc)',
                    },
                    {
                        name: 'Connection Connected',
                        value: 'connection.connected',
                        description: 'Triggered when device connects to WhatsApp',
                    },
                    {
                        name: 'Connection Disconnected',
                        value: 'connection.disconnected',
                        description: 'Triggered when device disconnects',
                    },
                    {
                        name: 'Logged Out',
                        value: 'logged_out',
                        description: 'Triggered when device logs out',
                    },
                    {
                        name: 'QR Code',
                        value: 'qr',
                        description: 'Triggered when QR code is generated',
                    },
                    {
                        name: 'Group Join',
                        value: 'group.join',
                        description: 'Triggered when joining a new group',
                    },
                    {
                        name: 'Group Update',
                        value: 'group.update',
                        description: 'Triggered when group is updated',
                    },
                    {
                        name: 'Presence Update',
                        value: 'presence.update',
                        description: 'Triggered when user status changes (typing, online, etc)',
                    },
                    {
                        name: 'Call Offer',
                        value: 'call.offer',
                        description: 'Triggered when there is an incoming call',
                    },
                ],
                default: ['message'],
                required: true,
                description: 'The events to listen to',
            },
            {
                displayName: 'Options',
                name: 'options',
                type: 'collection',
                placeholder: 'Add Option',
                default: {},
                options: [
                    {
                        displayName: 'Device ID Filter',
                        name: 'deviceIdFilter',
                        type: 'string',
                        default: '',
                        description: 'Only trigger for specific device ID (leave empty for all devices)',
                        placeholder: 'D-2J3IG',
                    },
                    {
                        displayName: 'Filter From Me',
                        name: 'filterFromMe',
                        type: 'boolean',
                        default: true,
                        displayOptions: {
                            show: {
                                '/events': ['message'],
                            },
                        },
                        description: 'Whether to filter out messages sent by yourself (isFromMe=true)',
                    },
                    {
                        displayName: 'Filter Groups',
                        name: 'filterGroups',
                        type: 'options',
                        displayOptions: {
                            show: {
                                '/events': ['message'],
                            },
                        },
                        options: [
                            {
                                name: 'All Messages',
                                value: 'all',
                                description: 'Receive both group and individual messages',
                            },
                            {
                                name: 'Only Groups',
                                value: 'only_groups',
                                description: 'Only receive messages from groups',
                            },
                            {
                                name: 'Only Individual',
                                value: 'only_individual',
                                description: 'Only receive individual/private messages',
                            },
                        ],
                        default: 'all',
                        description: 'Filter messages by group type',
                    },
                    {
                        displayName: 'Message Type Filter',
                        name: 'messageTypeFilter',
                        type: 'multiOptions',
                        displayOptions: {
                            show: {
                                '/events': ['message'],
                            },
                        },
                        options: [
                            {
                                name: 'Text',
                                value: 'text',
                            },
                            {
                                name: 'Image',
                                value: 'image',
                            },
                            {
                                name: 'Video',
                                value: 'video',
                            },
                            {
                                name: 'Audio',
                                value: 'audio',
                            },
                            {
                                name: 'Document',
                                value: 'document',
                            },
                            {
                                name: 'Sticker',
                                value: 'sticker',
                            },
                            {
                                name: 'Location',
                                value: 'location',
                            },
                            {
                                name: 'Contact',
                                value: 'contact',
                            },
                        ],
                        default: [],
                        description: 'Filter by message type (empty = all types)',
                    },
                ],
            },
        ],
    };

    webhookMethods = {
        default: {
            async checkExists(this: IHookFunctions): Promise<boolean> {
                // For webhook triggers, we don't need to register with external service
                // The webhook URL is shown in n8n UI for user to configure in Kirimi dashboard
                return true;
            },
            async create(this: IHookFunctions): Promise<boolean> {
                return true;
            },
            async delete(this: IHookFunctions): Promise<boolean> {
                return true;
            },
        },
    };

    async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
        const bodyData = this.getBodyData() as IDataObject;
        const events = this.getNodeParameter('events') as string[];
        const options = this.getNodeParameter('options', {}) as IDataObject;

        // Get event type from payload
        const eventType = bodyData.event as string;

        // Check if this event should be processed
        if (!events.includes(eventType)) {
            return {
                workflowData: [[]],
            };
        }

        // Apply device ID filter if specified
        if (options.deviceIdFilter) {
            const deviceId = bodyData.deviceId as string;
            if (deviceId !== options.deviceIdFilter) {
                return {
                    workflowData: [[]],
                };
            }
        }

        // Apply message-specific filters
        if (eventType === 'message') {
            // Filter out messages from me if option is enabled
            if (options.filterFromMe === true) {
                const isFromMe = bodyData.isFromMe as boolean;
                if (isFromMe) {
                    return {
                        workflowData: [[]],
                    };
                }
            }

            // Filter by group type
            if (options.filterGroups) {
                const isFromGroup = bodyData.isFromGroup as boolean;
                const filterGroups = options.filterGroups as string;

                if (filterGroups === 'only_groups' && !isFromGroup) {
                    return {
                        workflowData: [[]],
                    };
                }
                if (filterGroups === 'only_individual' && isFromGroup) {
                    return {
                        workflowData: [[]],
                    };
                }
            }

            // Filter by message type
            if (options.messageTypeFilter && Array.isArray(options.messageTypeFilter)) {
                const messageTypeFilter = options.messageTypeFilter as string[];
                if (messageTypeFilter.length > 0) {
                    const messageType = bodyData.messageType as string;
                    if (!messageTypeFilter.includes(messageType)) {
                        return {
                            workflowData: [[]],
                        };
                    }
                }
            }
        }

        // Process the webhook data
        const returnData: IDataObject = {
            event: eventType,
            ...bodyData,
        };

        // Add metadata
        returnData.receivedAt = new Date().toISOString();

        return {
            workflowData: [
                [
                    {
                        json: returnData,
                    },
                ],
            ],
        };
    }
}
