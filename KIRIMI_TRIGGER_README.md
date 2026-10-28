# Kirimi Trigger and Kirimi Polling Trigger

Detailed guide for the two trigger nodes of `n8n-nodes-kirimi`. The overview lives in [README.md](./README.md).

| | Kirimi Trigger | Kirimi Polling Trigger |
|---|---|---|
| Delivery | Kirimi calls your n8n webhook URL | n8n asks Kirimi for recorded events |
| Needs a public https URL | Yes | No |
| Latency | Near real time | Up to one polling interval |
| Signature check | Automatic mode: yes. Manual mode: no | Not applicable (outbound requests only) |
| Registration | Automatic (API) or Manual (dashboard) | Automatic (API, poll mode) |

## Kirimi Trigger

### Registration modes

**Automatic (recommended)**

1. Add the node, select the **Kirimi API** credential.
2. Choose **Scope** (device or WABA), pick the device or WABA from the list (or enter its ID) and select
   1-20 events.
3. Activate the workflow. The node calls `POST /v1/webhook/subscribe` with the production webhook URL, stores
   the returned id and signing secret, and verifies every delivery. Deactivating the workflow calls
   `POST /v1/webhook/unsubscribe`.

Notes:

- The webhook URL must be https. If n8n shows an http URL, set the `WEBHOOK_URL` environment variable to your
  public https address.
- Changing the scope, the ID, the events or the webhook URL replaces the subscription on the next activation.
- Switching an existing node from Manual to Automatic: remove the old URL from the Kirimi dashboard, because
  unsigned deliveries to the same URL are rejected with 401 and retried.

**Manual**

1. Add the node, choose the events.
2. Activate the workflow and copy the **Production URL** of the node.
3. In the Kirimi dashboard, open the webhook settings of the device or WABA, paste the URL and enable the
   same events.

In Manual mode requests are not signature-checked, and no credential is required. Use the Device ID filter
to keep other devices out of the workflow.

During development you can use the **Test URL**: click *Listen for test event*, then send a message to the
device.

### Events

Device (QR): `message`, `message.outgoing`, `message.history`, `message.sent`, `message.failed`,
`message.ack` (WABA only), `message.reaction`, `message.deleted`, `message.edited`, `connection.connected`,
`connection.disconnected`, `logged_out`, `qr`, `group.join`, `group.leave`, `group.update`,
`presence.update` (not delivered yet), `call.offer`, `device.created`, `device.connected`,
`device.status_changed`, `device.last_active`, `device.reconnected`.

WABA: `message`, `message.sent`, `message.ack`, `message.failed`, `template.status_update`,
`template.quality_update`, `account.review_update`, `account.alerts`, `account.banned`,
`phone_number.quality_update`, `message.echo` (coexistence).

Kirimi enables `message`, `message.sent`, `message.failed`, `message.ack`, `connection.connected`,
`connection.disconnected` and `logged_out` by default. `qr`, `group.*`, `presence.update` and `call.offer`
must be enabled explicitly on the Kirimi side.

### Options

| Option | Applies to | Description |
|--------|------------|-------------|
| Device ID Filter | all events | Only trigger for one device ID. For WABA events use the `phone_number_id` |
| Filter From Me | `message` | Drop messages sent by the account itself (`isFromMe`). Enabled by default when you add the option |
| Filter Groups | `message` | All messages, only groups, only individual chats |
| Message Type Filter | `message` | text, image, video, audio, document, sticker, location, contact. Empty means all |

### Output

Every payload is an envelope with a unique `id`, `created_at` and `event`. The node adds `eventId` (equal to
`id`) and `receivedAt`.

Incoming text message:

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

Incoming image: the same fields with `messageType: "image"`, `mediaUrl` and `caption`.

Connection event:

```json
{
  "event": "connection.connected",
  "deviceId": "D-2J3IG",
  "status": "connected",
  "receivedAt": "2026-10-28T13:15:07.123Z"
}
```

### Signature verification (Automatic mode)

Each delivery carries `X-Kirimi-Timestamp` and `X-Kirimi-Signature` =
`hex(HMAC_SHA256(secret, "<timestamp>.<raw body>"))`. The node answers `401 {"error":"Invalid webhook
signature"}` and does not start the workflow when the secret is unknown, a header is missing or malformed,
the timestamp differs from the current time by more than 300 seconds, or the signature does not match.
See the README for a verification snippet you can reuse in your own services.

### Retries and duplicates

Kirimi retries a failed delivery up to 7 times over about 5 hours, always with the same event id. The node
remembers the last 200 event ids and ignores repeats. A delivery for an event type you did not select, or one
rejected by a filter, is acknowledged with an empty result so Kirimi does not retry it.

## Kirimi Polling Trigger

For n8n instances that cannot receive webhooks.

### Setup

1. Add the node, select the **Kirimi API** credential.
2. Choose **Scope**, the device or WABA and 1-20 events.
3. Choose how often to poll in **Poll Times** and activate the workflow.

### Behavior

- The first poll subscribes in poll mode: `POST /v1/webhook/subscribe` with `device_id` or `waba_id`,
  `events`, `delivery: "poll"` and a label, without `target_url`. Kirimi records events for the scope and
  never delivers them. The returned id is kept in the workflow's static data.
- Every poll calls `POST /v1/webhook/events` for the scope with `limit: 100` and emits the events that are
  newer than the cursor, oldest first. The cursor is the newest `created_at` handled so far; ids of handled
  events (bounded to 500) break ties between events with the same timestamp.
- The first poll after activation records the cursor and emits nothing, so old events do not flood the
  workflow.
- Changing the scope or ID creates a new subscription and resets the cursor. Changing only the events
  replaces the subscription and keeps the cursor.
- If Kirimi answers 404 or 410 for the events call (subscription removed), the node subscribes again on the
  next poll.
- **Fetch Test Event** returns the most recent recorded event and leaves the cursor untouched.
- At most 100 events are read per poll. For busy numbers use a short interval.

### Cleaning up

n8n offers no deactivation hook for polling triggers, so the subscription stays when the workflow is
deactivated. Re-activating the workflow reuses it (Kirimi keeps one poll subscription per user, scope and
delivery mode). Remove it with the Kirimi node: **Webhook Subscription > Unsubscribe** and the subscription
id.

## Example workflows

- **Auto-reply**: Kirimi Trigger (`message`, Filter From Me) > IF > Kirimi: Send Message to `{{ $json.from }}`.
- **Store messages**: Kirimi Trigger (`message`) > Postgres or Google Sheets insert of `from`, `message`,
  `messageType` and `receivedAt`.
- **Disconnect alert**: Kirimi Trigger (`connection.disconnected`, `logged_out`) > Slack or Telegram.
- **No public URL**: Kirimi Polling Trigger (`message`) > any of the above.

## Tips

- Select only the events you need and add filters: every delivery that reaches the node costs an execution
  only when it passes the filters.
- Add an IF or Switch node after the trigger to branch on `messageType` or on keywords.
- Use the Kirimi node's **Auto-Generate Client Message ID** option when replying, so a retried execution does
  not send the reply twice.
- Test with the node's Test URL (or **Fetch Test Event** for the polling trigger) before activating.

## Troubleshooting

**No data arrives (Kirimi Trigger)**
- The workflow must be active (Production URL) or listening (Test URL).
- Automatic mode: check the Kirimi dashboard for the subscription and that the n8n webhook URL is https and
  reachable from the internet.
- Manual mode: the URL in the dashboard must match the node's URL exactly and the event must be enabled.
- Check the Device ID filter and the other filters.

**401 responses (Automatic mode)**
The signature check failed. Common causes: an old Manual-mode URL still registered in the dashboard, a proxy
that rewrites the request body before it reaches n8n, or a server clock that is more than 5 minutes off.

**Nothing arrives (Kirimi Polling Trigger)**
Events are recorded only after the poll subscription exists, so the first poll never emits. Send a new
message and wait for the next poll. Check that the selected events include the one you expect.

**Webhook timeout**
Kirimi expects a quick answer. The trigger answers immediately and runs the workflow afterwards; keep any
heavy processing inside the workflow, not in front of it.

## Links

- API documentation: https://kirimi.id/docs
- Issues: https://github.com/kiriminow/n8n-nodes-kirimi/issues
