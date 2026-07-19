# 🚀 UCP Deployment Guide

This guide covers deploying the UCP platform to **Vercel** (Next.js app) + **Railway/Render** (Realtime Gateway) + **Neon/Vercel Postgres** (database).

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
                       │  Neon / Vercel Postgres (shared) │
                       │  - Multi-tenant schema           │
                       │  - Read by both services         │
                       └──────────────────────────────────┘
```

**Why split?**
- Vercel doesn't support long-running WebSocket processes (max 300s timeout)
- Socket.io requires a persistent server → deploy Gateway on Railway/Render (cheap, supports long-running processes)
- Both services share the same PostgreSQL database (Gateway reads API keys, Next.js reads/writes everything)

---

## 🗄 Step 1: Provision PostgreSQL Database

### Option A: Neon (Recommended — serverless Postgres, generous free tier)

1. Go to https://neon.tech and sign up (free)
2. Create a new project
3. Copy the connection string — looks like:
   ```
   postgresql://neondb:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Save it as `DATABASE_URL` — you'll use it in both Vercel and Railway

### Option B: Vercel Postgres

1. In your Vercel dashboard → Storage → Create Database → Postgres
2. Copy the connection string

### Option C: Supabase

1. Go to https://supabase.com and create a project
2. Settings → Database → Connection string → URI
3. Add `?sslmode=require` if not present

---

## 🌐 Step 2: Deploy Next.js App to Vercel

### Via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repo: `elmoorx0/ucp-platform`
3. **Framework Preset**: Next.js (auto-detected)
4. **Root Directory**: `./` (default)
5. **Build Command**: `bun run vercel-build` (auto-detected from `vercel.json`)
6. **Install Command**: `bun install` (auto-detected)

### Environment Variables (CRITICAL — set all of these)

In Vercel → Project → Settings → Environment Variables:

| Name | Value | Environments |
|------|-------|--------------|
| `DATABASE_PROVIDER` | `postgresql` | Production, Preview, Development |
| `DATABASE_URL` | `postgresql://...?sslmode=require&pgbouncer=true&connect_timeout=15` | All |
| `JWT_SECRET` | (run `openssl rand -base64 48`) | All |
| `API_KEY_HASH_SECRET` | (run `openssl rand -base64 32`) | All |
| `INTERNAL_API_TOKEN` | (run `openssl rand -base64 32`) | All |
| `REALTIME_GATEWAY_URL` | `https://your-gateway.up.railway.app` (set in Step 3) | All |
| `NODE_ENV` | `production` | Production |

> ⚠️ **Important about `DATABASE_URL`**: Add `&pgbouncer=true&connect_timeout=15` to the connection string. This enables PgBouncer connection pooling, which is required for serverless (Vercel) to avoid exhausting DB connections.

### Deploy

1. Click **Deploy**
2. Wait for build to complete (~2 min)
3. Your app will be live at `https://ucp-platform-xxx.vercel.app`
4. Run database migration:
   ```bash
   # Locally, with DATABASE_URL set to your production Postgres
   DATABASE_PROVIDER=postgresql DATABASE_URL=your-prod-url bun run db:push
   ```
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
| `DATABASE_PROVIDER` | `postgresql` |
| `DATABASE_URL` | `postgresql://...?sslmode=require` (same as Vercel, but WITHOUT pgbouncer=true) |
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
fly secrets set DATABASE_PROVIDER=postgresql
fly secrets set DATABASE_URL="postgresql://..."
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
    "body": "Sent via UCP on Vercel"
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

For local dev (with hot reload):

```bash
# 1. Install dependencies
bun install
cd mini-services/realtime-gateway && bun install && cd ../..

# 2. Set up local SQLite database
echo 'DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./db/custom.db
JWT_SECRET=dev-secret-min-32-chars-long-please
API_KEY_HASH_SECRET=dev-api-key-secret
INTERNAL_API_TOKEN=dev-internal-token
REALTIME_GATEWAY_URL=http://localhost:3003' > .env

# 3. Push schema to local DB
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

- Make sure `DATABASE_URL` includes `?sslmode=require` (Neon/Supabase require SSL)
- Make sure `DATABASE_PROVIDER=postgresql` (not `sqlite`)
- For Vercel Postgres: add `&pgbouncer=true&connect_timeout=15`

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

- Check that `DATABASE_PROVIDER` env var is set before build
- Verify `prisma generate` runs in `postinstall` (it's in `package.json`)
- If Prisma binary fails: add `PRISMA_ENGINES_MIRROR=https://registry.npmjs.org` env var

### Notifications not delivered

- Check that In-App notifications need a connected Socket.io client (no client = no delivery, but notification is persisted)
- For Push/Email: install `firebase-admin` / `nodemailer` packages and configure providers in Dashboard
- Check Audit Log in Dashboard for `notification.target.sent` or `notification.target.failed` events

---

## 💰 Cost Estimate (Free Tier)

| Service | Free Tier | Paid Plan |
|---------|-----------|-----------|
| **Vercel** | Hobby: 100GB bandwidth, unlimited static, 100h serverless | Pro: $20/mo |
| **Neon** | Free: 0.5GB storage, 1 project | Pro: $19/mo (10GB) |
| **Railway** | Trial: $5 credit (~1 month) | Hobby: $5/mo + usage |
| **Render** | Free (sleeps after 15 min) | Starter: $7/mo |

**Total free tier**: ~$0/mo for low-traffic deployments
**Production-ready**: ~$25/mo (Vercel Pro + Neon Pro + Railway Hobby)

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Prisma on Vercel](https://www.prisma.io/docs/guides/deploying-to-vercel)
- [Neon Documentation](https://neon.tech/docs)
- [Railway Documentation](https://docs.railway.app)
- [Socket.io Documentation](https://socket.io/docs/v4/)

---

**Need help?** Open an issue: https://github.com/elmoorx0/ucp-platform/issues
