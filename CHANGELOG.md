# Changelog

## 1.5.0

Verification readiness and usability release. Saved workflows keep working: no parameter name or option value
was renamed, and new parameters default to the previous behavior.

### Added
- **Device and WABA pickers**: every Device ID / WABA ID field is a searchable resource locator ("From List" /
  "By ID") in Kirimi and Kirimi Trigger. Lists come from `POST /v1/list-devices` (paginated) and
  `POST /v1/waba/accounts` (an empty list when the server answers 404).
- **Node versioning**: Kirimi and Kirimi Trigger are now `[1, 2]`. Existing workflows stay on version 1 with
  plain-text IDs; new nodes use version 2 with the pickers.
- **Kirimi Polling Trigger**: new trigger for n8n instances without a public https URL, built on poll-mode
  subscriptions (`delivery: "poll"`) and `POST /v1/webhook/events` with a persistent cursor.
- **Auto-Generate Client Message ID** option on Send Message, Send Message Fast and Send Message File:
  derives a stable `n8n-<executionId>-<nodeNameHash>-<itemIndex>` idempotency key and returns it as
  `clientMsgId`.
- `usableAsTool` on the Kirimi node (AI agent tool).
- Dark icon variants.
- Unit tests (`npm test`, `node:test`, no extra dependencies): signature verification, replay tolerance, 401
  path, event de-duplication, client message id, poll cursor, event option builders, list search, multipart.
- `LICENSE.md`, `CHANGELOG.md`, CI workflow.

### Changed
- Tooling migrated to the official n8n starter setup: `@n8n/node-cli`, ESLint 9 flat config, Prettier 3,
  TypeScript 5. Gulp and the old ESLint setup are gone. `n8n.strict` is enabled.
- Requests go through `httpRequestWithAuthentication`: the credential's `authenticate` now injects
  `user_code` and `secret`. They are no longer copied into the body by the node.
- `send-message-file` no longer uses the deprecated `helpers.request`. The multipart body is built with the
  global `FormData` and `Blob`, serialized to a Buffer and sent with `helpers.httpRequest`; field names are
  unchanged (`user_code`, `secret`, `device_id`, `receiver`, `file`, `message`, `caption`, `fileName`,
  `quotedMessageId`, `clientMsgId`).
- Signature verification and event de-duplication moved into pure, tested modules.
- Release workflow replaced by the starter's `publish.yml`: npm trusted publishing with provenance on `*.*.*`
  and `v*.*.*` tags, after lint, build, `validate.js` and tests.
- Documentation rewritten in English; the OTP guide is folded into the README.
- Node group changed from `communication` to `output` (no effect on saved workflows).

### Removed
- `gulpfile.js`, `.eslintrc.js`, `.eslintignore`, `index.js`, `OTP_V2_GUIDE.md`.

## 1.4.0

- **Idempotency**: optional *Client Message ID* on Send Message, Send Message Fast and Send Message File
  (`Idempotency-Key` header, or `clientMsgId` form field for files).
- **Get Message Status** operation (`/v1/message-status`).
- **Webhook Subscription** resource: Subscribe, Unsubscribe, List Events.
- **Kirimi Trigger automatic mode**: registers the webhook through the API on activation, verifies the
  `X-Kirimi-Signature` HMAC with a 300 second tolerance, drops duplicate event ids, removes the subscription on
  deactivation.
- Broadcast: `message` is optional when a Media URL is given; file name and typing effect are no longer sent.
- Aligned operations and error surfacing (`message` and `data.code`) with the current Kirimi API.
