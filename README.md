# n8n-nodes-kirimi

This is an n8n community node for integrating with the Kirimi WhatsApp Unofficial API.

## Features

The Kirimi node provides comprehensive integration with Kirimi's WhatsApp Unofficial API, including:

### OTP Management
- Generate OTP and send via WhatsApp
- Validate OTP codes
- Customizable OTP length, type, and messages

### Message Sending
- Send individual WhatsApp messages
- Send messages in fast mode (no typing effect)
- Broadcast messages to multiple recipients
- Support for text and media messages

### Device Management
- Create new WhatsApp devices
- Connect devices via QR code
- Check device status
- List all devices
- Renew device subscriptions

### Contact Management
- Save individual contacts
- Bulk save multiple contacts

### Package & Billing
- List available packages
- Create deposits for top-up
- Check deposit status

### User Information
- Get user account information

### Security & Monitoring
- Check OTP security status
- Get merchant reputation
- View customer OTP statistics

### Utilities
- Test phone number normalization

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
   - Base URL: https://api.kirimi.id/v1 (default)

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
