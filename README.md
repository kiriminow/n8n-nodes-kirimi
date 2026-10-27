# n8n-nodes-kirimi

This is an n8n community node for integrating with the Kirimi WhatsApp API (QR devices and WABA Cloud API).

## Features

The Kirimi node provides comprehensive integration with Kirimi's WhatsApp API, including:

### OTP Management
- **OTP V2 (Recommended)**: Three method support
  - WhatsApp (Kirimi channel): billed per delivered OTP
  - Device: use your own device, free and customizable
  - WABA User: use your own WABA with an approved AUTHENTICATION template
- Verify OTP V2 (`v2/otp/verify`)
- **OTP Reverse**: create a reverse OTP request and check its status (`v2/otp-reverse/create`, `v2/otp-reverse/status`)
- OTP V1: Legacy generate and validate OTP
- Customizable OTP length, type, and custom message

### Message Sending
- Send individual WhatsApp messages (`send-message`)
- Send messages in fast mode — no typing effect (`send-message-fast`)
- Send file via multipart upload, max 50MB (`send-message-file`)
- Broadcast messages to multiple recipients (`broadcast-message`) with label, delays and scheduling
  - Max 1000 numbers per call (package cap: 500 free, 2000 paid), duplicates removed, max 10 broadcasts per hour
  - `message` is optional when a Media URL is given; at least one of them is required
  - File name and typing effect are ignored by the server for broadcasts and are no longer sent
- **Idempotency**: Send Message, Send Message Fast and Send Message File accept an optional *Client Message ID*
  (1-128 chars of `[A-Za-z0-9._:-]`). JSON operations send it as the `Idempotency-Key` header, the file
  operation as the `clientMsgId` form field. Retrying with the same key within 24 hours never sends twice.
- **Get Message Status** (`message-status`): look up a message by its Client Message ID. Returns
  `clientMsgId`, `state` (`processing` | `sent` | `failed` | `unknown`), `message_id`, `created_at`,
  `sent_at`, `delivered_at`, `read_at`, `error_message`. Use it after a `409 DELIVERY_UNKNOWN`.

### WABA (WhatsApp Business API)
- Send template messages via Meta Cloud API (`waba/send-message`)
- Reply within a conversation (`waba/messages/reply`)
- List conversations (`waba/conversations`)
- Sync message templates (`waba/templates/sync`)
- Send and verify OTP via WABA (`waba/send-otp`, `waba/verify-otp`)

### Device Management
- Create a device (`create-device`)
- Connect a device (`connect-device`)
- Renew a device (`renew-device`)
- Check device connection status (`device-status`)
- Get full device details (`device-status-enhanced`)
- List all devices (`list-devices`)

### Contact Management
- Save a single contact (`save-contact`)
- Save up to 1000 contacts at once (`save-contacts-bulk`)

### Package, Deposit & Billing
- List available packages (`list-packages`)
- Create a deposit and get the payment link (`create-deposit`)
- Check a deposit status (`deposit-status`)
- Cancel an unpaid deposit (`cancel-deposit`)
- List deposits with optional status filter (`list-deposits`)

### User Information
- Get user account information (`user-info`)

### Webhook Subscriptions
- **Subscribe** (`webhook/subscribe`): HTTPS target URL, scope (device or WABA), 1-20 events, optional label.
  The response contains a signing `secret` that is returned **once** - store it.
- **Unsubscribe** (`webhook/unsubscribe`) by subscription id
- **List Events** (`webhook/events`): recent events for a device or WABA (limit 1-100, default 20),
  one n8n item per event

### Webhook Trigger
- Two registration modes: **Automatic** (registers itself through the API, verifies the HMAC signature)
  and **Manual** (paste the URL in the Kirimi dashboard, default)
- Receive webhook events from Kirimi (23 device events, 10 WABA events)
- Filter events by type (message, connection, QR, etc)
- Duplicate deliveries are dropped (event id)
- Filter messages by sender, type, and group status
- Auto-process incoming WhatsApp messages
- Real-time notifications for device status changes

## Installation

1. Install in n8n community nodes:
   ```
   npm install n8n-nodes-kirimi
   ```

2. Restart n8n to load the node

## Configuration

1. Create Kirimi API credentials in n8n:
   - User Code: Your Kirimi API user code
   - Secret: Your Kirimi API secret key
   - Base URL: https://api.kirimi.id (default, no version prefix)

2. Get your credentials from [Kirimi Documentation](https://dash.kirimi.id/docs)

## Usage

### Regular Actions (Kirimi Node)

1. Add the Kirimi node to your workflow
2. Select the appropriate resource and operation
3. Configure the required parameters
4. Execute the workflow

### Webhook Trigger (Kirimi Trigger Node)

1. Add the "Kirimi Trigger" node to your workflow
2. Select the events you want to receive (e.g., "Message", "Connection Connected")
3. Configure optional filters (device ID, message type, etc)
4. Choose a registration mode:
   - **Automatic (Recommended)**: pick scope (device or WABA), the device/WABA ID and the events, and select
     Kirimi API credentials. Activating the workflow registers the webhook; deactivating removes it.
     Requires an https n8n URL. Failed deliveries are retried up to 7 times over about 5 hours with the same event id.
   - **Manual (default)**: activate the workflow, copy the webhook URL and configure it in your
     [Kirimi Dashboard](https://dashboard.kirimi.id). The server retries up to 7 times over about 5 hours.

For detailed webhook trigger usage, see [KIRIMI_TRIGGER_README.md](./KIRIMI_TRIGGER_README.md)

## API Documentation

For detailed API documentation, visit: https://kirimi.id/docs

## Support

For issues and feature requests, please visit: https://github.com/kiriminow/n8n-nodes-kirimi/issues

## License

MIT# n8n-nodes-kirimi
