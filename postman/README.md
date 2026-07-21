# UCP Postman Collection

Complete API collection for testing UCP endpoints.

## Quick Start

1. **Import both files** into Postman:
   - `ucp-collection.json` — the API collection
   - `ucp-environment.json` — environment variables

2. **Select the environment** in Postman (top-right dropdown)

3. **Run "Seed Demo Data"** request first (under "Setup" folder):
   - This creates demo data and auto-sets the `apiKey` and `projectId` variables
   - Check the Postman console for the seeded credentials

4. **Test other endpoints** — they'll use the auto-configured variables

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `apiUrl` | `http://localhost:3000` | UCP Next.js API URL |
| `gatewayUrl` | `http://localhost:3003` | Realtime Gateway URL |
| `apiKey` | (auto-set after seed) | API key for authentication |
| `projectId` | (auto-set after seed) | Current project ID |
| `notificationId` | (auto-set after send) | Last sent notification ID |

## Collections Structure

```
UCP - Universal Communication Platform/
├── System/
│   ├── Health Check
│   ├── OpenAPI Spec
│   └── Prometheus Metrics
├── Setup/
│   ├── Seed Demo Data
│   └── Dashboard Login
├── Notifications/
│   ├── Send Notification
│   ├── Send from Template (OTP - Arabic)
│   ├── Send from Template (Welcome - English)
│   ├── List Notifications
│   ├── Get Notification by ID
│   ├── Cancel Notification
│   ├── List Scheduled Notifications
│   └── Schedule a Notification
├── Users & Devices/
│   ├── Register End User
│   ├── List End Users
│   ├── Register Device (Android FCM)
│   ├── Register Device (Web Push)
│   └── List Devices
├── Realtime & Presence/
│   ├── Broadcast to Channel
│   ├── Get Online Users
│   ├── Get User Presence
│   └── List Channels
├── Templates & Webhooks/
│   ├── List Templates
│   └── Test Webhook
├── Project & Stats/
│   ├── Get Project Info
│   ├── Get Stats
│   ├── List Events
│   └── List Providers
└── API Key Management/
    └── Rotate API Key
```

## Auto-Variables

The collection includes test scripts that auto-set variables:

- **Seed Demo Data** → sets `apiKey` and `projectId`
- **Send Notification** → sets `notificationId` for use in Get/Cancel requests

## Production Usage

For production, duplicate the environment and update:
- `apiUrl`: `https://your-app.vercel.app`
- `gatewayUrl`: `https://your-gateway.up.railway.app`
- `apiKey`: your production API key

## Tips

- All requests include an auto-generated `X-Request-ID` header for tracing
- Use the Postman Console to see auto-set variables
- The collection uses `{{variable}}` syntax for dynamic values
