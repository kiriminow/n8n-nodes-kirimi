# n8n-nodes-kirimi

n8n community nodes for [Kirimi](https://kirimi.id): send WhatsApp messages, OTP and broadcasts through
QR-paired devices or the WhatsApp Business Cloud API (WABA), and react to incoming WhatsApp events.

The package contains one credential and three nodes:

| Node | Purpose |
|------|---------|
| **Kirimi** | Actions: messages, OTP, devices, contacts, WABA, billing, webhook subscriptions. Usable as an AI agent tool. |
| **Kirimi Trigger** | Webhook trigger (signed Automatic mode, or Manual mode). Needs an n8n instance reachable over https. |
| **Kirimi Polling Trigger** | Polling trigger for n8n instances that have no public https URL. |

- [Installation](#installation)
- [Credentials](#credentials)
- [Kirimi node](#kirimi-node) (resources and operations)
- [Device and WABA pickers](#device-and-waba-pickers)
- [Idempotency and message status](#idempotency-and-message-status)
- [Kirimi Trigger](#kirimi-trigger) and [Kirimi Polling Trigger](#kirimi-polling-trigger)
- [Verifying webhook signatures](#verifying-webhook-signatures)
- [Example workflows](#example-workflows)
- [Compatibility and upgrading](#compatibility-and-upgrading)
- [Development](#development)

## Installation

Follow the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/):
in n8n open **Settings > Community Nodes > Install** and enter `n8n-nodes-kirimi`.

For a self-hosted instance you can also install it manually:

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-kirimi
```

Restart n8n afterwards. To let AI agents call the Kirimi node as a tool on self-hosted n8n, set
`N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.

## Credentials

Create a **Kirimi API** credential:

| Field | Description |
|-------|-------------|
| User Code | Your Kirimi API user code |
| Secret | Your Kirimi API secret |
| Base URL | `https://api.kirimi.id` (default, no version prefix) |

Both values are shown in the Kirimi dashboard under API credentials. The credential injects `user_code` and
`secret` into the JSON body of every request. **Test** in the credential dialog calls `POST /v1/user-info`.

## Kirimi node

Pick a **Resource**, then an **Operation**. Every operation returns the API response as one n8n item
(List Events returns one item per event).

### Message

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| Send Message | `/v1/send-message` | Text and/or media URL, optional quoted message, typing effect |
| Send Message Fast | `/v1/send-message-fast` | Same without typing effect |
| Send Message File | `/v1/send-message-file` | Uploads a binary property of the incoming item (multipart, max 50 MB) |
| Broadcast Message | `/v1/broadcast-message` | Label, numbers, delays, optional schedule. Max 1000 numbers per call, 10 broadcasts per hour. A message, a media URL, or both is required |
| Get Message Status | `/v1/message-status` | Look up a message by its Client Message ID |

### OTP

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| Send OTP V2 (recommended) | `/v2/otp/send` | Methods: **WhatsApp** (Kirimi channel, billed per delivered OTP), **Device** (your own device, custom message with an `{{otp}}` placeholder), **WABA User** (your own WABA and an approved AUTHENTICATION template) |
| Verify OTP V2 | `/v2/otp/verify` | Takes the phone number and the OTP code; an OTP allows a limited number of attempts |
| Create OTP Reverse | `/v2/otp-reverse/create` | The user sends a code to your device; optional callback URL and result messages |
| Get OTP Reverse Status | `/v2/otp-reverse/status` | By token |
| Generate OTP (V1) / Validate OTP (V1) | `/v1/generate-otp`, `/v1/validate-otp` | Legacy, device only |

Phone numbers use the international format without `+` (for example `628123456789`). Request a new OTP when
one has expired or its attempts are used up.

### WABA

| Operation | Endpoint |
|-----------|----------|
| Send Template Message | `/v1/waba/send-message` (variables, header and dynamic URL / copy-code buttons) |
| Reply Message | `/v1/waba/messages/reply` |
| List Conversations | `/v1/waba/conversations` |
| Sync Templates | `/v1/waba/templates/sync` |
| Send OTP / Verify OTP | `/v1/waba/send-otp`, `/v1/waba/verify-otp` |

### Device

Create Device, Connect Device, Renew Device, Device Status, Device Status Enhanced, List Devices
(`/v1/create-device`, `/v1/connect-device`, `/v1/renew-device`, `/v1/device-status`,
`/v1/device-status-enhanced`, `/v1/list-devices`).

### Contact

Save Contact and Save Contacts (Bulk, up to 1000 entries) (`/v1/save-contact`, `/v1/save-contacts-bulk`),
optionally into a specific device.

### Package, Deposit, User

List Packages, Create / Cancel / List Deposits, Deposit Status, User Info
(`/v1/list-packages`, `/v1/create-deposit`, `/v1/cancel-deposit`, `/v1/list-deposits`, `/v1/deposit-status`,
`/v1/user-info`).

### Webhook Subscription

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| Subscribe | `/v1/webhook/subscribe` | https target URL, scope (device or WABA), 1-20 events, optional label. The response contains the signing `secret`, returned **once**: store it |
| Unsubscribe | `/v1/webhook/unsubscribe` | By subscription id |
| List Events | `/v1/webhook/events` | Recent events of a device or WABA, limit 1-100, one item per event |

### Errors

API errors are raised as n8n API errors. The server message and its code (for example
`IDEMPOTENCY_IN_PROGRESS`, `DELIVERY_UNKNOWN`, `USE_WABA_ENDPOINT`) are shown in the error description. Enable
**Continue On Fail** to receive `{ "error": "..." }` items instead.

## Device and WABA pickers

Every Device ID and WABA ID field is a resource locator with two modes:

- **From List**: searchable dropdown filled from `POST /v1/list-devices` (50 per page, more pages load on
  scroll) or `POST /v1/waba/accounts`. If your server does not have the WABA accounts endpoint yet, the list
  is simply empty: use **By ID**.
- **By ID**: type or map an ID with an expression, for example `{{ $json.device_id }}`.

## Idempotency and message status

Send Message, Send Message Fast and Send Message File accept a **Client Message ID** (1-128 characters of
`A-Z a-z 0-9 . _ : -`). JSON operations send it as the `Idempotency-Key` header, the file operation as the
`clientMsgId` form field. Retrying with the same key within 24 hours never sends the message twice.

Turn on **Auto-Generate Client Message ID** to let the node derive the key
`n8n-<executionId>-<nodeNameHash>-<itemIndex>` (the run index is appended when the node runs more than once
in an execution, for example in a loop). A retried execution of the same item reuses the same key. A Client
Message ID you type always wins. The key that was used is added to the output as `clientMsgId`.

**Get Message Status** returns `clientMsgId`, `state` (`processing`, `sent`, `failed` or `unknown`),
`message_id`, `created_at`, `sent_at`, `delivered_at`, `read_at` and `error_message`. Use it after a
`409 DELIVERY_UNKNOWN` response before deciding to retry.

## Kirimi Trigger

Add the **Kirimi Trigger** node as the start of a workflow and activate the workflow. Choose a registration
mode:

### Automatic (recommended)

Pick the scope (device or WABA), the device or WABA and 1-20 events, and select the Kirimi API credential.
Activating the workflow registers the webhook with Kirimi (`POST /v1/webhook/subscribe`); deactivating it
removes the subscription. The node stores the subscription `secret` and **rejects every request whose HMAC
signature is invalid or stale with HTTP 401**, see [Verifying webhook signatures](#verifying-webhook-signatures).
Requires an https webhook URL: set `WEBHOOK_URL` on your n8n instance if needed. Changing the scope, URL or
events replaces the subscription automatically.

If the node used to be in Manual mode, remove its URL from the Kirimi dashboard: otherwise those unsigned
deliveries are rejected and retried.

### Manual

Activate the workflow, copy the production webhook URL into the Kirimi dashboard (Webhooks) and select the
same events. No credential is needed, and requests are **not** signature-checked in this mode.

### Events

- Device (QR): `message`, `message.outgoing`, `message.history`, `message.sent`, `message.failed`,
  `message.ack` (WABA only, not sent for QR devices), `message.reaction`, `message.deleted`, `message.edited`,
  `connection.connected`, `connection.disconnected`, `logged_out`, `qr`, `group.join`, `group.leave`,
  `group.update`, `presence.update` (not delivered yet), `call.offer`, `device.created`, `device.connected`,
  `device.status_changed`, `device.last_active`, `device.reconnected`.
- WABA: `message`, `message.sent`, `message.ack`, `message.failed`, `template.status_update`,
  `template.quality_update`, `account.review_update`, `account.alerts`, `account.banned`,
  `phone_number.quality_update`, `message.echo` (coexistence).

### Options

Device ID filter (for WABA events this is the `phone_number_id`), Filter From Me, Filter Groups
(all, only groups, only individual) and Message Type Filter (text, image, video, audio, document, sticker,
location, contact). The last three apply to `message` events.

### Output

The webhook envelope is passed through, plus `eventId` (the event `id`) and `receivedAt`:

```json
{
  "id": "8f14e45f-ceea-4d1a-9a1e-2f5c6b7d8e90",
  "created_at": "2026-10-28T20:15:07.000+07:00",
  "event": "message",
  "deviceId": "D-2J3IG",
  "msgId": "3EB03F895D0BA042B04A69",
  "from": "6282171836262",
  "name": "Jane",
  "message": "hello",
  "isFromGroup": false,
  "isFromMe": false,
  "messageType": "text",
  "mediaUrl": "",
  "eventId": "8f14e45f-ceea-4d1a-9a1e-2f5c6b7d8e90",
  "receivedAt": "2026-10-28T13:15:07.123Z"
}
```

Failed deliveries are retried by Kirimi up to 7 times over about 5 hours with the same event id. The trigger
keeps the last 200 event ids and drops repeats, so a retried delivery does not start the workflow twice.

## Kirimi Polling Trigger

Use this node when your n8n instance cannot receive webhooks (no public https URL, behind NAT, local
development). It asks Kirimi for recorded events on a schedule instead.

1. Add **Kirimi Polling Trigger**, choose the scope, the device or WABA, and the events (1-20).
2. Set the polling interval in the node's **Poll Times** setting and activate the workflow.

How it works:

- On the first poll the node subscribes in poll mode (`POST /v1/webhook/subscribe` with `delivery: "poll"`
  and no target URL: Kirimi only records the events, nothing is delivered) and remembers the subscription.
  The subscription is reused while the scope and events stay the same and is replaced when they change.
- Each poll calls `POST /v1/webhook/events` (up to 100 newest events) and emits the events newer than the
  stored cursor, **oldest first**. The cursor is the `created_at` of the newest handled event plus a bounded
  set (500) of handled event ids, so events sharing a timestamp are not lost or duplicated.
- The first poll after activation only records the cursor: events that happened before activation are not
  emitted.
- **Fetch Test Event** (manual execution) returns the latest recorded event without moving the cursor.
- If more than 100 events arrive between two polls, only the newest 100 can be fetched: shorten the polling
  interval for busy numbers.
- Each item is the recorded event: `id`, `event`, `created_at` and the event payload.

n8n has no "deactivate" hook for polling nodes, so the poll subscription is **not** removed automatically when
you deactivate or delete the workflow. It is reused when you activate the workflow again. To delete it, use the
Kirimi node: **Webhook Subscription > Unsubscribe** with the subscription id (see *Webhook Subscription > List
Events* or the Kirimi dashboard).

## Verifying webhook signatures

Kirimi signs every delivery of an automatic (auto-registered) subscription:

- `X-Kirimi-Timestamp`: unix time in seconds
- `X-Kirimi-Signature`: `hex(HMAC_SHA256(secret, "<timestamp>.<raw body>"))`, optionally prefixed `sha256=`
- `X-Kirimi-Event` and `X-Kirimi-Event-Id`: event name and unique id

The Kirimi Trigger in Automatic mode checks this for you: a missing secret, missing or malformed headers, a
timestamp more than 300 seconds away from the current time (replay protection) or a signature mismatch
(constant-time comparison over the raw request body) all answer **401** and do not start the workflow.

If you receive Kirimi webhooks in your own service, verify them the same way:

```js
const { createHmac, timingSafeEqual } = require('node:crypto');

function verify(secret, timestamp, signature, rawBody) {
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const received = signature.replace(/^sha256=/i, '').toLowerCase();
  return expected.length === received.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
```

## Example workflows

**Auto-reply to incoming messages**
Kirimi Trigger (event `message`, Filter From Me on) > IF (`{{ $json.message }}` contains "price") >
Kirimi: Message > Send Message (device from the list, receiver `{{ $json.from }}`).

**Send a PDF receipt exactly once**
Webhook (order paid) > HTTP Request (download the PDF) > Kirimi: Message > Send Message File with
**Auto-Generate Client Message ID** on. If the execution is retried after a timeout the message is not
sent twice; add Kirimi: Get Message Status when you need to confirm the final state.

**Login OTP**
Webhook (login request) > Kirimi: OTP > Send OTP V2 (method Device or WhatsApp) > Respond to Webhook.
A second workflow calls Verify OTP V2 with the phone number and the code the user typed.

**Alert when a device disconnects**
Kirimi Trigger (events `connection.disconnected`, `logged_out`) > Slack or Telegram message.

**Behind NAT, no public URL**
Kirimi Polling Trigger (event `message`, poll every minute) > Google Sheets: Append Row.

**Scheduled broadcast**
Schedule Trigger > Google Sheets (read numbers) > Code (join numbers with commas) > Kirimi: Message >
Broadcast Message.

## Compatibility and upgrading

- Built against `n8n-workflow` 2.x. Requires Node.js 18 or newer (global `FormData` and `Blob`).
- The package has no runtime dependencies.
- Version 1.5.0 introduces **node version 2** of Kirimi and Kirimi Trigger (device and WABA pickers).
  Workflows saved with earlier versions keep node version 1 and their plain-text IDs and keep working
  unchanged; newly added nodes use version 2. All parameter names and option values are unchanged.
- See [CHANGELOG.md](./CHANGELOG.md).

## Development

```bash
npm install
npm run lint      # n8n-node lint (strict, cloud compatible)
npm run build     # n8n-node build
npm test          # unit tests (node:test, no extra dependencies)
node validate.js  # package structure checks, also run in CI
npm run dev       # n8n with the nodes loaded and hot reload
```

Releases are published by the GitHub Actions workflow in `.github/workflows/publish.yml` when a tag
(`1.5.0` or `v1.5.0`, equal to the version in `package.json`) is pushed. It publishes with npm provenance.

## Links

- API documentation: https://kirimi.id/docs
- Issues: https://github.com/kiriminow/n8n-nodes-kirimi/issues
- API alignment notes: [API-ALIGNMENT.md](./API-ALIGNMENT.md)

## License

[MIT](./LICENSE.md)
