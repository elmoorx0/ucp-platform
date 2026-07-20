# UCP JavaScript SDK

Universal Communication Platform — lightweight client for browser and Node.js.

## Installation

```bash
npm install ucp-platform-sdk
# or
bun add ucp-platform-sdk
```

## Quick Start

```typescript
import { UCP } from 'ucp-platform-sdk'

const ucp = new UCP({
  apiUrl: 'https://your-app.vercel.app',
  gatewayUrl: 'https://your-gateway.up.railway.app',
  apiKey: 'ucp_live_xxx',
})

// Send a notification
await ucp.notifications.send({
  channel: 'inapp',
  to: ['user-001'],
  title: 'Hello',
  body: 'World',
})

// Send from template
await ucp.notifications.sendTemplate('welcome', { name: 'Alice' }, {
  to: ['user-001'],
  locale: 'ar',
})

// Register a device
await ucp.devices.register({
  externalUserId: 'user-001',
  token: 'firebase-token',
  platform: 'android',
})

// Connect to realtime
const socket = ucp.realtime.connect('user-001')
socket.on('inapp:notification', (data) => console.log('Got notif:', data))
```

## API Reference

### `new UCP(config)`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiUrl` | string | ✅ | Base URL of the UCP Next.js API |
| `gatewayUrl` | string | ⚠️ | URL of the Realtime Gateway (required for realtime) |
| `apiKey` | string | ✅ | API key (ucp_live_xxx) |
| `timeout` | number | ❌ | Request timeout in ms (default: 30000) |

### Methods

#### `ucp.notifications.send(options)` → Promise
Send a notification.

#### `ucp.notifications.sendTemplate(template, variables, options)` → Promise
Send a notification using a pre-defined template.

#### `ucp.notifications.list(params)` → Promise
List notifications.

#### `ucp.notifications.get(id)` → Promise
Get a single notification with delivery details.

#### `ucp.notifications.cancel(id)` → Promise
Cancel a pending notification.

#### `ucp.devices.register(options)` → Promise
Register a device (FCM token, Web Push subscription).

#### `ucp.devices.list(params)` → Promise
List registered devices.

#### `ucp.users.register(options)` → Promise
Register or update an end user.

#### `ucp.users.list(params)` → Promise
List end users.

#### `ucp.templates.list()` → Promise
List available notification templates.

#### `ucp.realtime.connect(userId, options?)` → Socket
Connect to the Realtime Gateway as a specific user.

#### `ucp.webhooks.test(event, projectId?)` → Promise
Test the project's webhook URL.

#### `ucp.webhooks.verifySignature(payload, signature, secret)` → boolean
Verify a webhook signature (for receiving webhooks).

#### `ucp.stats.get(params)` → Promise
Get notification statistics.

#### `ucp.presence.getOnline(projectId?)` → Promise
Get online users.

#### `ucp.presence.get(userId, projectId?)` → Promise
Get a specific user's presence status.

#### `ucp.health()` → Promise
Health check.

## License

MIT
