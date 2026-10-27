import { createHmac, timingSafeEqual } from 'crypto';

import {
    IHookFunctions,
    IWebhookFunctions,
    IDataObject,
    INodeProperties,
    INodeType,
    INodeTypeDescription,
    IWebhookResponseData,
    NodeOperationError,
} from 'n8n-workflow';

import { kirimiApiRequest } from '../Kirimi/GenericFunctions';
import {
    MAX_SUBSCRIPTION_EVENTS,
    allEventOptions,
    deviceEventOptions,
    wabaEventOptions,
} from '../Kirimi/events';

const SIGNATURE_TOLERANCE_SECONDS = 300;
const MAX_REMEMBERED_EVENT_IDS = 200;

type HookContext = IHookFunctions | IWebhookFunctions;

interface AutoConfig {
    scope: string;
    scopeId: string;
    events: string[];
}

const sortedKey = (events: string[]): string => [...new Set(events)].sort().join(',');

const getAutoConfig = (ctx: IHookFunctions): AutoConfig => {
    const scope = ctx.getNodeParameter('scope') as string;
    const scopeId = (
        scope === 'waba'
            ? (ctx.getNodeParameter('wabaId') as string)
            : (ctx.getNodeParameter('deviceId') as string)
    ).trim();
    const events = ctx.getNodeParameter(
        scope === 'waba' ? 'autoWabaEvents' : 'autoDeviceEvents',
    ) as string[];
    return { scope, scopeId, events };
};

const withAuth = async (ctx: HookContext, body: IDataObject): Promise<IDataObject> => {
    const credentials = await ctx.getCredentials('kirimiApi');
    return { user_code: credentials.userCode, secret: credentials.secret, ...body };
};

const isNotFound = (error: unknown): boolean => {
    const err = error as any;
    return String(err?.httpCode ?? err?.statusCode ?? err?.response?.status ?? '') === '404';
};

const unsubscribeById = async (ctx: IHookFunctions, id: string): Promise<void> => {
    try {
        const response = await kirimiApiRequest.call(
            ctx,
            'POST',
            '/v1/webhook/unsubscribe',
            await withAuth(ctx, { id }),
        );
        if (response?.success === false) {
            throw new NodeOperationError(ctx.getNode(), response.message || 'Failed to revoke the Kirimi subscription');
        }
    } catch (error) {
        if (!isNotFound(error)) throw error;
    }
};

const clearSubscription = (staticData: IDataObject): void => {
    delete staticData.subscriptionId;
    delete staticData.secret;
    delete staticData.targetUrl;
    delete staticData.scope;
    delete staticData.scopeId;
    delete staticData.eventsKey;
};

const verifySignature = (ctx: IWebhookFunctions, secret: string | undefined): boolean => {
    if (!secret) return false;
    const req = ctx.getRequestObject();
    const signatureHeader = req.headers['x-kirimi-signature'];
    const timestampHeader = req.headers['x-kirimi-timestamp'];
    if (typeof signatureHeader !== 'string' || typeof timestampHeader !== 'string') return false;

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp)) return false;
    if (Math.abs(Date.now() / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

    const rawBody = (req as any).rawBody as Buffer | string | undefined;
    const bodyText =
        rawBody !== undefined
            ? Buffer.isBuffer(rawBody)
                ? rawBody.toString('utf8')
                : String(rawBody)
            : JSON.stringify(ctx.getBodyData());

    const expected = createHmac('sha256', secret)
        .update(`${timestampHeader}.${bodyText}`)
        .digest('hex');
    const received = signatureHeader.trim().replace(/^sha256=/i, '').toLowerCase();

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(received, 'utf8');
    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, receivedBuffer);
};

const buildFilterOptions = (onlyForMessageEvent: boolean): INodeProperties[] => {
    const messageDisplay = onlyForMessageEvent
        ? { displayOptions: { show: { '/events': ['message'] } } }
        : {};
    return [
        {
            displayName: 'Device ID Filter',
            name: 'deviceIdFilter',
            type: 'string',
            default: '',
            description:
                'Only trigger for specific device ID (leave empty for all devices). For WABA events the device ID is the phone_number_id.',
            placeholder: 'D-2J3IG',
        },
        {
            displayName: 'Filter From Me',
            name: 'filterFromMe',
            type: 'boolean',
            default: true,
            ...messageDisplay,
            description: 'Whether to filter out messages sent by yourself (isFromMe=true)',
        },
        {
            displayName: 'Filter Groups',
            name: 'filterGroups',
            type: 'options',
            ...messageDisplay,
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
            ...messageDisplay,
            options: [
                { name: 'Audio', value: 'audio' },
                { name: 'Contact', value: 'contact' },
                { name: 'Document', value: 'document' },
                { name: 'Image', value: 'image' },
                { name: 'Location', value: 'location' },
                { name: 'Sticker', value: 'sticker' },
                { name: 'Text', value: 'text' },
                { name: 'Video', value: 'video' },
            ],
            default: [],
            description: 'Filter by message type (empty = all types)',
        },
    ];
};

export class KirimiTrigger implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Kirimi Trigger',
        name: 'kirimiTrigger',
        icon: 'file:kirimi.svg',
        group: ['trigger'],
        version: 1,
        subtitle: '={{$parameter["registration"] === "auto" ? "auto: " + $parameter["scope"] : $parameter["events"].join(", ")}}',
        description: 'Handle Kirimi WhatsApp webhook events',
        defaults: {
            name: 'Kirimi Trigger',
        },
        inputs: [],
        outputs: ['main'] as any,
        credentials: [
            {
                name: 'kirimiApi',
                required: true,
                displayOptions: {
                    show: {
                        registration: ['auto'],
                    },
                },
            },
        ],
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
                displayName: 'Registration',
                name: 'registration',
                type: 'options',
                options: [
                    {
                        name: 'Automatic (Recommended)',
                        value: 'auto',
                        description:
                            'Registers the webhook through the Kirimi API on activation and verifies the HMAC signature. If this node was in Manual mode before, remove its URL from the Kirimi dashboard, otherwise those unsigned deliveries are rejected and retried.',
                    },
                    {
                        name: 'Manual (Paste URL in Kirimi Dashboard)',
                        value: 'manual',
                        description:
                            'Copy the webhook URL into the Kirimi dashboard yourself. The server retries failed deliveries up to 7 times over about 5 hours.',
                    },
                ],
                default: 'manual',
                description: 'How the webhook is registered with Kirimi',
            },
            {
                displayName: 'Scope',
                name: 'scope',
                type: 'options',
                displayOptions: { show: { registration: ['auto'] } },
                options: [
                    { name: 'Device (QR)', value: 'device' },
                    { name: 'WABA', value: 'waba' },
                ],
                default: 'device',
                description: 'Whether to subscribe on a QR device or on a WABA',
            },
            {
                displayName: 'Device ID',
                name: 'deviceId',
                type: 'string',
                required: true,
                displayOptions: { show: { registration: ['auto'], scope: ['device'] } },
                default: '',
                placeholder: 'D-2J3IG',
                description: 'The WhatsApp device ID to subscribe to',
            },
            {
                displayName: 'WABA ID',
                name: 'wabaId',
                type: 'string',
                required: true,
                displayOptions: { show: { registration: ['auto'], scope: ['waba'] } },
                default: '',
                description: 'Your WABA ID to subscribe to',
            },
            {
                displayName: 'Events',
                name: 'autoDeviceEvents',
                type: 'multiOptions',
                required: true,
                displayOptions: { show: { registration: ['auto'], scope: ['device'] } },
                options: deviceEventOptions(),
                default: ['message'],
                description: 'The events to listen to (1-20)',
            },
            {
                displayName: 'Events',
                name: 'autoWabaEvents',
                type: 'multiOptions',
                required: true,
                displayOptions: { show: { registration: ['auto'], scope: ['waba'] } },
                options: wabaEventOptions(),
                default: ['message'],
                description: 'The events to listen to (1-20)',
            },
            {
                displayName: 'Events',
                name: 'events',
                type: 'multiOptions',
                displayOptions: { show: { registration: ['manual'] } },
                options: allEventOptions(),
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
                displayOptions: { show: { registration: ['manual'] } },
                options: buildFilterOptions(true),
            },
            {
                displayName: 'Options',
                name: 'autoOptions',
                type: 'collection',
                placeholder: 'Add Option',
                default: {},
                displayOptions: { show: { registration: ['auto'] } },
                options: buildFilterOptions(false),
            },
        ],
    };

    webhookMethods = {
        default: {
            async checkExists(this: IHookFunctions): Promise<boolean> {
                // Manual mode: the user pastes the webhook URL into the Kirimi dashboard.
                if (this.getNodeParameter('registration', 'manual') !== 'auto') return true;

                const staticData = this.getWorkflowStaticData('node');
                if (!staticData.subscriptionId) return false;

                const { scope, scopeId, events } = getAutoConfig(this);
                const unchanged =
                    staticData.targetUrl === this.getNodeWebhookUrl('default') &&
                    staticData.scope === scope &&
                    staticData.scopeId === scopeId &&
                    staticData.eventsKey === sortedKey(events);

                // Stale subscription (URL, scope or events changed): remove it before re-creating.
                if (!unchanged) {
                    await unsubscribeById(this, staticData.subscriptionId as string);
                    clearSubscription(staticData);
                }
                // Always re-subscribe: the server may have revoked the subscription (410, device
                // deleted, manual unsubscribe), and subscribe is idempotent per user+scope+url.
                return false;
            },
            async create(this: IHookFunctions): Promise<boolean> {
                if (this.getNodeParameter('registration', 'manual') !== 'auto') return true;

                const { scope, scopeId, events } = getAutoConfig(this);
                const targetUrl = this.getNodeWebhookUrl('default') as string;

                if (!/^https:\/\//i.test(targetUrl)) {
                    throw new NodeOperationError(
                        this.getNode(),
                        'Kirimi requires an https webhook URL, but this n8n instance exposes: ' +
                            targetUrl +
                            '. Use Manual registration, or set the WEBHOOK_URL environment variable to an https URL.',
                    );
                }
                if (!scopeId) {
                    throw new NodeOperationError(
                        this.getNode(),
                        scope === 'waba' ? 'WABA ID is required' : 'Device ID is required',
                    );
                }
                if (events.length < 1 || events.length > MAX_SUBSCRIPTION_EVENTS) {
                    throw new NodeOperationError(
                        this.getNode(),
                        `Select between 1 and ${MAX_SUBSCRIPTION_EVENTS} events`,
                    );
                }

                const workflow = this.getWorkflow();
                const label = `n8n: ${workflow.name || workflow.id || ''}`.slice(0, 100);
                const requestedKey = sortedKey(events);

                const subscribe = async (): Promise<IDataObject> => {
                    const response = await kirimiApiRequest.call(
                        this,
                        'POST',
                        '/v1/webhook/subscribe',
                        await withAuth(this, {
                            target_url: targetUrl,
                            [scope === 'waba' ? 'waba_id' : 'device_id']: scopeId,
                            events,
                            label,
                        }),
                    );
                    return (response?.data ?? {}) as IDataObject;
                };

                let data = await subscribe();
                // The server is idempotent on (user, scope, url) and returns the existing row
                // with its OLD events. Replace it once if the events differ.
                if (data.id && sortedKey((data.events as string[]) ?? []) !== requestedKey) {
                    await unsubscribeById(this, data.id as string);
                    data = await subscribe();
                }

                if (!data.id || !data.secret) {
                    throw new NodeOperationError(
                        this.getNode(),
                        'Kirimi did not return a subscription id and secret',
                    );
                }

                const staticData = this.getWorkflowStaticData('node');
                staticData.subscriptionId = data.id as string;
                staticData.secret = data.secret as string;
                staticData.targetUrl = targetUrl;
                staticData.scope = scope;
                staticData.scopeId = scopeId;
                staticData.eventsKey = requestedKey;
                return true;
            },
            async delete(this: IHookFunctions): Promise<boolean> {
                if (this.getNodeParameter('registration', 'manual') !== 'auto') return true;

                const staticData = this.getWorkflowStaticData('node');
                if (staticData.subscriptionId) {
                    await unsubscribeById(this, staticData.subscriptionId as string);
                    clearSubscription(staticData);
                }
                return true;
            },
        },
    };

    async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
        const registration = this.getNodeParameter('registration', 'manual') as string;
        const isAuto = registration === 'auto';
        const staticData = this.getWorkflowStaticData('node');
        const bodyData = this.getBodyData() as IDataObject;
        const headers = this.getHeaderData();

        if (isAuto && !verifySignature(this, staticData.secret as string | undefined)) {
            this.getResponseObject().status(401).json({ error: 'Invalid webhook signature' });
            return { noWebhookResponse: true };
        }

        const options = this.getNodeParameter(isAuto ? 'autoOptions' : 'options', {}) as IDataObject;
        const events = isAuto
            ? (this.getNodeParameter(
                  (this.getNodeParameter('scope') as string) === 'waba'
                      ? 'autoWabaEvents'
                      : 'autoDeviceEvents',
              ) as string[])
            : (this.getNodeParameter('events') as string[]);

        // Body first: it is covered by the signature, the X-Kirimi-Event header is not
        const headerEvent = headers['x-kirimi-event'];
        const eventType = (bodyData.event ??
            (typeof headerEvent === 'string' ? headerEvent : undefined)) as string;

        // Deduplicate on event id
        const headerEventId = headers['x-kirimi-event-id'];
        const eventId = (bodyData.id ??
            (typeof headerEventId === 'string' ? headerEventId : undefined)) as string | undefined;
        const seenIds = (staticData.processedEventIds as string[] | undefined) ?? [];
        if (eventId && seenIds.includes(eventId)) {
            return { workflowData: undefined };
        }

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

        if (eventId) {
            staticData.processedEventIds = [...seenIds, eventId].slice(-MAX_REMEMBERED_EVENT_IDS);
        }

        // Process the webhook data
        const returnData: IDataObject = {
            event: eventType,
            ...bodyData,
        };

        // Add metadata
        returnData.eventId = eventId ?? null;
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
