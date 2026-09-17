# n8n-nodes-kirimi

This is an n8n community node for integrating with the Kirimi WhatsApp Unofficial API.

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

### Webhook Trigger (NEW!)
- Receive webhook events from Kirimi
- Filter events by type (message, connection, QR, etc)
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
4. Activate the workflow to get your webhook URL
5. Copy the webhook URL and configure it in your [Kirimi Dashboard](https://dashboard.kirimi.id)

For detailed webhook trigger usage, see [KIRIMI_TRIGGER_README.md](./KIRIMI_TRIGGER_README.md)

## API Documentation

For detailed API documentation, visit: https://kirimi.id/docs

## Support

For issues and feature requests, please visit: https://github.com/kiriminow/n8n-kirimi-nodes/issues

## License

MIT# n8n-nodes-kirimi
