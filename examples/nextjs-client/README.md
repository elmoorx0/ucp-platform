# UCP Next.js Client Demo

Complete example showing how to integrate UCP into a Next.js application.

## Features Demonstrated

1. **Realtime Connection** — connect to the UCP Gateway via Socket.io
2. **Receive In-App Notifications** — live, push-based (no polling)
3. **Send Notifications** — via REST API
4. **Send from Templates** — with variable interpolation
5. **Register Users** — create end users in the platform
6. **Broadcast to Channels** — server-side broadcast to channel subscribers
7. **Presence Tracking** — see who's online
8. **Activity Log** — real-time log of all actions

## Quick Start

### 1. Set up UCP first

Make sure you have UCP running:
- Next.js API on `http://localhost:3000`
- Realtime Gateway on `http://localhost:3003`
- Seed demo data (visit `http://localhost:3000` and click "Seed Demo Data")

### 2. Create a new Next.js project (or use existing)

```bash
npx create-next-app@latest ucp-client-demo
cd ucp-client-demo
```

### 3. Install dependencies

```bash
npm install socket.io-client
```

### 4. Copy the demo page

Copy `page.tsx` to your Next.js project:
```bash
cp page.tsx your-nextjs-project/app/ucp-demo/page.tsx
```

### 5. Set environment variables

Create `.env.local`:
```env
NEXT_PUBLIC_UCP_API_URL=http://localhost:3000
NEXT_PUBLIC_UCP_GATEWAY_URL=http://localhost:3003
NEXT_PUBLIC_UCP_API_KEY=ucp_live_xxx  # Your API key from UCP dashboard
```

### 6. Run

```bash
npm run dev
```

Visit `http://localhost:3000/ucp-demo`

## Usage

1. **Enter a User ID** (e.g., `user-001`)
2. **Click "Connect"** — connects to the Realtime Gateway
3. **Click "Register User"** — registers the user in UCP
4. **Type a message** and click **"Send In-App"** — you'll receive it live!
5. **Try "Send Welcome Template"** — sends a templated notification
6. **Try "Send OTP Template"** — sends a 6-digit OTP
7. **Broadcast to channel** — sends to all subscribers of "demo-channel"

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Next.js Demo   │────►│   UCP Next.js   │────►│   Realtime      │
│  (Browser)      │     │   API (REST)    │     │   Gateway       │
│                 │     │                 │     │   (Socket.io)   │
│  Socket.io ◄────┼─────┼─────────────────┼─────┼─────────────────│
│  Client         │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                 │
        └───────────── WebSocket (live) ─────────────────┘
```

1. The browser connects directly to the Gateway via Socket.io
2. When sending a notification, the browser calls the UCP REST API
3. The API processes the notification and pushes it to the Gateway
4. The Gateway delivers it to the connected browser instantly

## Production Considerations

- **Don't expose API keys in the browser** — in production, create a backend endpoint that proxies requests to UCP
- **Use scoped API keys** — only grant `notifications:send`, `devices:register`, etc.
- **Enable HTTPS** — required for Web Push and secure WebSockets
- **Add authentication** — your app should authenticate users before connecting to UCP

## Integration with Your Existing App

Instead of using this demo as-is, integrate UCP into your existing Next.js app:

```typescript
// lib/ucp.ts
import { UCP } from 'ucp-platform-sdk'

export const ucp = new UCP({
  apiUrl: process.env.UCP_API_URL!,
  gatewayUrl: process.env.UCP_GATEWAY_URL!,
  apiKey: process.env.UCP_API_KEY!, // server-side only
})

// app/api/notify/route.ts
import { ucp } from '@/lib/ucp'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId, message } = await req.json()
  
  await ucp.notifications.send({
    channel: 'inapp',
    to: [userId],
    title: 'New message',
    body: message,
  })
  
  return NextResponse.json({ success: true })
}

// app/dashboard/layout.tsx
'use client'
import { useEffect } from 'react'
import { io } from 'socket.io-client'

export function DashboardLayout({ children, userId }) {
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_UCP_GATEWAY_URL!, {
      auth: { apiKey: 'ucp_live_xxx', userId },
    })
    
    socket.on('inapp:notification', (data) => {
      // Show notification in your UI
      showToast(data.title, data.body)
    })
    
    return () => socket.disconnect()
  }, [userId])
  
  return <>{children}</>
}
```
