# 🚀 UCP Deployment Guide

This guide covers deploying the UCP platform using **SQLite everywhere**:
- **Local dev**: SQLite file (`db/custom.db`)
- **Production**: Turso (libSQL — SQLite in the cloud, serverless-friendly)

Both modes use the **same Prisma schema** — only the `DATABASE_URL` format differs.

---

## 📐 Architecture Overview

```
                       ┌─────────────────────────────────────┐
                       │           Browser / Mobile          │
                       │  (Dashboard + Socket.io client)     │
                       └────────────┬─────────────┬──────────┘
                                    │             │
                       HTTPS (REST) │             │ WSS (Socket.io)
                                    │             │
                                    ▼             ▼
                       ┌─────────────┐   ┌──────────────────┐
                       │   Vercel    │   │  Railway / Render│
                       │  Next.js    │──►│  Realtime Gateway│
                       │  (Serverless)│   │  (Socket.io + Bun)│
                       └──────┬──────┘   └────────┬─────────┘
                              │                   │
                              │ HTTP /internal/push
                              │                   │
                              ▼                   ▼
                       ┌──────────────────────────────────┐
                       │       Turso (libSQL/SQLite)       │
                       │  - Serverless SQLite database     │
                       │  - Shared by both services        │
                       │  - Free: 9GB, 1B reads/mo         │
                       └──────────────────────────────────┘
```

**Why Turso?**
- SQLite-compatible — same Prisma schema, zero migrations
- Serverless-friendly (HTTP-based, no connection pooling issues)
- Free tier: 9GB storage, 500 databases, 1 billion row reads/month
- Edge replicas (low latency globally)
- Works perfectly with Vercel serverless functions

---

## 🗄 Step 1: Provision Turso Database

### Install Turso CLI

```bash
# macOS / Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Verify installation
turso version
```

### Sign up and create a database

```bash
# Sign up (free — no credit card needed)
turso auth login

# Create a database
turso db create ucp

# Get the connection URL
turso db show ucp --url
# → libsql://ucp-<your-username>.turso.io

# Create an auth token
turso db tokens create ucp
# → eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...

# Combine into a single URL:
# libsql://ucp-<your-username>.turso.io?authToken=eyJhbGciOi...
```

Save this combined URL — you'll use it as `DATABASE_URL` in both Vercel and Railway.

---

## 🌐 Step 2: Deploy Next.js App to Vercel

### Via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repo: `elmoorx0/ucp-platform`
3. **Framework Preset**: Next.js (auto-detected)
4. **Build Command**: `bun run vercel-build` (auto-detected from `vercel.json`)
5. **Install Command**: `bun install` (auto-detected)

### Environment Variables (CRITICAL — set all of these)

In Vercel → Project → Settings → Environment Variables:

| Name | Value | Environments |
|------|-------|--------------|
| `DATABASE_URL` | `libsql://ucp-xxx.turso.io?authToken=eyJ...` | Production, Preview, Development |
| `JWT_SECRET` | (run `openssl rand -base64 48`) | All |
| `API_KEY_HASH_SECRET` | (run `openssl rand -base64 32`) | All |
| `INTERNAL_API_TOKEN` | (run `openssl rand -base64 32`) | All |
| `REALTIME_GATEWAY_URL` | `https://your-gateway.up.railway.app` (set in Step 3) | All |
| `NODE_ENV` | `production` | Production |

### Deploy & Initialize DB

1. Click **Deploy**
2. Wait for build to complete (~2 min)
3. Push the schema to Turso (locally, with production `DATABASE_URL`):
   ```bash
   DATABASE_URL="libsql://ucp-xxx.turso.io?authToken=eyJ..." bun run db:push
   ```
4. Your app will be live at `https://ucp-platform-xxx.vercel.app`
5. Seed demo data:
   ```bash
   curl -X POST https://your-app.vercel.app/api/dashboard/seed?force=true
   ```

---

## ⚡ Step 3: Deploy Realtime Gateway to Railway

### Via Railway Dashboard

1. Go to https://railway.app and sign in with GitHub
2. **New Project** → **Deploy from GitHub repo** → select `elmoorx0/ucp-platform`
3. **Settings**:
   - **Root Directory**: `mini-services/realtime-gateway`
   - **Builder**: Dockerfile (auto-detected from `Dockerfile`)
4. **Variables** (Settings → Variables):

| Name | Value |
|------|-------|
| `DATABASE_URL` | `libsql://ucp-xxx.turso.io?authToken=eyJ...` (same Turso URL as Vercel) |
| `API_KEY_HASH_SECRET` | (same value as Vercel) |
| `INTERNAL_API_TOKEN` | (same value as Vercel) |
| `JWT_SECRET` | (same value as Vercel) |
| `NODE_ENV` | `production` |
| `PORT` | `3003` (or leave empty — Railway auto-injects `$PORT`) |

5. **Settings → Networking**:
   - **Generate Domain** → e.g., `ucp-gateway-production.up.railway.app`
   - This gives you a public HTTPS URL for your Gateway

6. Wait for deployment to complete (~1 min)
7. Verify: visit `https://your-gateway.up.railway.app/health` — should return JSON with `ok: true`

### Update Vercel

Go back to Vercel → Environment Variables and set:
```
REALTIME_GATEWAY_URL = https://your-gateway.up.railway.app
```
Then redeploy the Vercel app (Deployments → Redeploy).

---

## 🔄 Alternative: Deploy Gateway to Render

If you prefer Render over Railway:

1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. **Settings**:
   - **Name**: `ucp-realtime-gateway`
   - **Region**: closest to your users
   - **Branch**: `main`
   - **Root Directory**: `mini-services/realtime-gateway`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: Free ($0/mo, sleeps after 15 min) or Starter ($7/mo, always-on)
4. **Environment Variables**: same as Railway (above)
5. **Health Check Path**: `/health`
6. Create Web Service → wait ~2 min for build
7. Your Gateway URL will be: `https://ucp-realtime-gateway.onrender.com`

Or use the included `render.yaml` blueprint:
1. Go to https://render.com → New → Blueprint
2. Select your GitHub repo
3. Render will auto-detect `render.yaml` and create the service
4. Fill in the `sync: false` env vars manually

---

## ✈ Alternative: Deploy Gateway to Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# From the gateway directory
cd mini-services/realtime-gateway

# Create a new Fly app
fly launch --no-deploy

# Set secrets
fly secrets set DATABASE_URL="libsql://ucp-xxx.turso.io?authToken=eyJ..."
fly secrets set API_KEY_HASH_SECRET="..."
fly secrets set INTERNAL_API_TOKEN="..."
fly secrets set JWT_SECRET="..."
fly secrets set NODE_ENV=production

# Deploy
fly deploy
```

---

## 🧪 Verify Deployment

### 1. Health Check (Vercel)

```bash
curl https://your-app.vercel.app/api/health
```

Expected:
```json
{
  "status": "healthy",
  "checks": {
    "database": { "ok": true },
    "gateway": { "ok": true, "service": "ucp-realtime-gateway", "socketCount": 0 }
  }
}
```

### 2. Gateway Health Check

```bash
curl https://your-gateway.up.railway.app/health
```

Expected:
```json
{
  "ok": true,
  "service": "ucp-realtime-gateway",
  "dbType": "turso",
  "socketCount": 0,
  "uptime": 12.5
}
```

### 3. Seed Demo Data

```bash
curl -X POST https://your-app.vercel.app/api/dashboard/seed?force=true
```

You'll get back credentials (`admin@ucp.local` / `ucp-admin-2026`) and an API key.

### 4. Test REST API

```bash
curl -X POST https://your-app.vercel.app/api/v1/notifications \
  -H "Content-Type: application/json" \
  -H "x-api-key: ucp_live_xxx" \
  -d '{
    "channel": "inapp",
    "to": ["user-001"],
    "title": "Hello from production!",
    "body": "Sent via UCP on Vercel + Turso"
  }'
```

### 5. Test Socket.io Connection

```javascript
import { io } from 'socket.io-client'

const socket = io('https://your-gateway.up.railway.app', {
  auth: {
    apiKey: 'ucp_live_xxx',
    userId: 'user-001'
  }
})

socket.on('connect', () => console.log('Connected to gateway!'))
socket.on('inapp:notification', (data) => console.log('Got notif:', data))
```

---

## 🔧 Local Development

For local dev with hot reload (uses local SQLite file):

```bash
# 1. Install dependencies
bun install
cd mini-services/realtime-gateway && bun install && cd ../..

# 2. Set up local SQLite database
echo 'DATABASE_URL=file:./db/custom.db
JWT_SECRET=dev-secret-min-32-chars-long-please
API_KEY_HASH_SECRET=dev-api-key-secret
INTERNAL_API_TOKEN=dev-internal-token
REALTIME_GATEWAY_URL=http://localhost:3003' > .env

# 3. Push schema to local SQLite DB
bun run db:push

# 4. Start the Gateway (terminal 1)
bun run gateway

# 5. Start Next.js (terminal 2)
bun run dev

# 6. Seed demo data
curl -X POST http://localhost:3000/api/dashboard/seed?force=true

# 7. Open http://localhost:3000
```

---

## 🚨 Troubleshooting

### "Database connection failed" on Vercel

- Make sure `DATABASE_URL` starts with `libsql://` (not `file:`) in production
- Verify the Turso auth token is correct (regenerate with `turso db tokens create ucp`)
- Test the connection locally:
  ```bash
  DATABASE_URL="libsql://..." bun -e "import('@libsql/client').then(({createClient}) => createClient({url: process.env.DATABASE_URL}).execute('SELECT 1').then(r => console.log('OK', r))).catch(e => console.error(e.message))"
  ```

### "Gateway not reachable" in Vercel health check

- Verify `REALTIME_GATEWAY_URL` is set correctly (no trailing slash)
- Check Gateway logs on Railway/Render for errors
- Make sure `INTERNAL_API_TOKEN` is the same on both services
- Verify the Gateway URL is publicly accessible: `curl https://your-gateway/health`

### Socket.io client can't connect

- Make sure you're using the Gateway URL (not Vercel URL) for Socket.io
- The Gateway URL must be HTTPS in production
- Check browser console for CORS errors
- Make sure the API key has `realtime:broadcast` scope if broadcasting

### Build fails on Vercel

- Check that `DATABASE_URL` env var is set before build
- Verify `prisma generate` runs in `postinstall` (it's in `package.json`)
- If Prisma binary fails: add `PRISMA_ENGINES_MIRROR=https://registry.npmjs.org` env var

### Turso-specific errors

- **"SQLITE_BUSY"**: Turso handles this automatically with HTTP retries; should not occur
- **"database is locked"**: Should not happen with Turso (only with local SQLite under heavy concurrent writes)
- **"authToken required"**: Your `DATABASE_URL` is missing `?authToken=xxx`
- **Rate limit (429)**: Free tier allows 1B reads/mo — should be plenty. Upgrade if needed.

### Notifications not delivered

- Check that In-App notifications need a connected Socket.io client (no client = no delivery, but notification is persisted)
- For Push/Email: install `firebase-admin` / `nodemailer` packages and configure providers in Dashboard
- Check Audit Log in Dashboard for `notification.target.sent` or `notification.target.failed` events

---

## 💰 Cost Estimate

| Service | Free Tier | Paid Plan |
|---------|-----------|-----------|
| **Vercel** | Hobby: 100GB bandwidth, unlimited static, 100h serverless | Pro: $20/mo |
| **Turso** | Free: 9GB storage, 500 DBs, 1B reads/mo, 25M writes/mo | Scaler: $29/mo |
| **Railway** | Trial: $5 credit (~1 month) | Hobby: $5/mo + usage |
| **Render** | Free (sleeps after 15 min) | Starter: $7/mo |

**Total free tier**: ~$0/mo for low-traffic deployments
**Production-ready**: ~$25/mo (Vercel Pro + Turso Scaler + Railway Hobby)

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Prisma + Turso Guide](https://www.prisma.io/docs/concepts/database-connectors/turso)
- [Turso Documentation](https://docs.turso.tech)
- [Railway Documentation](https://docs.railway.app)
- [Socket.io Documentation](https://socket.io/docs/v4/)

---

**Need help?** Open an issue: https://github.com/elmoorx0/ucp-platform/issues
