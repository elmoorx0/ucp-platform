# 🚀 Universal Communication Platform (UCP)

> **Communication as a Service (CPaaS)** — منصة اتصالات موحدة، مستقلة، متعددة المستأجرين (Multi-Tenant)، تعمل كطبقة وسيطة بين تطبيقاتك والمستخدمين.

[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-blue.svg)](https://www.prisma.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-black.svg)](https://socket.io/)
[![SQLite](https://img.shields.io/badge/SQLite-Turso-blue.svg)](https://turso.tech/)
[![Vercel Ready](https://img.shields.io/badge/Vercel-Ready-black.svg)](https://vercel.com/)
[![CI](https://github.com/elmoorx0/ucp-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/elmoorx0/ucp-platform/actions)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📖 الفهرس

- [نظرة عامة](#نظرة-عامة)
- [المميزات](#المميزات)
- [البنية التقنية](#البنية-التقنية)
- [النشر السريع (Vercel + Railway + Turso)](#النشر-السريع-vercel--railway--turso)
- [الخدمات](#الخدمات)
- [البدء السريع (Local Dev)](#البدء-السريع-local-dev)
- [REST API](#rest-api)
- [Realtime Gateway](#realtime-gateway)
- [Provider Abstraction](#provider-abstraction)
- [لوحة التحكم](#لوحة-التحكم)
- [النشر الإنتاجي](#النشر-الإنتاجي)

---

## 🎯 نظرة عامة

بدلاً من أن يقوم كل مشروع بإدارة الإشعارات أو WebSocket أو البريد الإلكتروني بنفسه، فإنه يرسل طلباً واحداً إلى UCP عبر REST API، وتتولى UCP تنفيذ العملية بالكامل باستخدام المزود (Provider) المناسب.

```
أي مشروع (PHP / Next.js / Rust / Laravel / Flutter ...)
            │
            │ REST API
            ▼
Universal Communication Platform (Next.js on Vercel)
            │
 ┌──────────┼──────────┐
 │          │          │
Notification  Realtime  Event Bus
 │          │          │
 ├── FCM
 ├── Email SMTP
 ├── Web Push
 ├── In-App (via Realtime Gateway)
 └── أي Provider آخر
            │
            ▼
      Browser / Android / iOS
```

---

## ✨ المميزات

- ✅ **منصة مستقلة** — تعمل مع أي مشروع أو لغة برمجة
- ✅ **REST API موحد** — جميع المشاريع تتصل بنفس الـ endpoint
- ✅ **Multi-Tenant** — دعم عدد غير محدود من المشاريع
- ✅ **Provider Pattern** — استبدال أي مزود بسهولة دون تغيير كود العميل
- ✅ **Push-based delivery** — لا يوجد polling، توصيل فوري عبر Socket.io
- ✅ **قابلية توسع** — من مشروع صغير إلى ملايين المستخدمين
- ✅ **أمان** — JWT + API Keys مع scopes + bcrypt-style hashing (scrypt)
- ✅ **Audit Log** — تتبع كل عملية في النظام
- ✅ **SQLite Everywhere** — SQLite محلياً، Turso (libSQL) للإنتاج — نفس الـ schema
- ✅ **Vercel-Ready** — متوافق تماماً مع Vercel + Railway + Turso
- ✅ **Rate Limiting** — حماية من الإفراط في الطلبات (sliding window)
- ✅ **Notification Templates** — قوالب جاهزة مع دعم i18n (en, ar, fr)
- ✅ **Webhook Delivery Receipts** — إيصالات تسليم موقعة بـ HMAC-SHA256
- ✅ **Automatic Retries** — إعادة محاولة تلقائية مع exponential backoff
- ✅ **OpenAPI Documentation** — مواصفات Swagger متاحة على `/api/docs`
- ✅ **JavaScript SDK** — مكتبة عميل جاهزة للاستخدام
- ✅ **CI/CD** — GitHub Actions للفحص التلقائي عند كل push

---

## 🏗 البنية التقنية

| المكون | التقنية | الاستضافة المقترحة |
|--------|---------|---------------------|
| **Frontend & API** | Next.js 16 (App Router) + TypeScript 5 | Vercel |
| **Database** | Prisma ORM + SQLite / Turso (libSQL) | Turso (مجاني) |
| **Realtime Gateway** | Socket.io + Bun (mini-service منفصل) | Railway / Render / Fly.io |
| **UI** | Tailwind CSS 4 + shadcn/ui + Recharts | (مدمج في Vercel) |
| **Auth** | JWT (Dashboard) + API Keys (Clients) | (مدمج) |
| **Process Runtime** | Bun (Gateway) + Node.js (Next.js) | — |

> 📖 **للتفاصيل الكاملة للنشر**: راجع [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🚀 النشر السريع (Vercel + Railway + Turso)

### 1. قاعدة البيانات (Turso - SQLite سحابي مجاني)
```bash
# تثبيت Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login

# إنشاء قاعدة بيانات
turso db create ucp
turso db show ucp --url           # libsql://ucp-xxx.turso.io
turso db tokens create ucp        # eyJhbGciOi...

# الجمع في URL واحد:
# libsql://ucp-xxx.turso.io?authToken=eyJhbGciOi...
```

### 2. تطبيق Next.js (Vercel)
1. اذهب إلى https://vercel.com/new
2. استورد الـ repo: `elmoorx0/ucp-platform`
3. أضف Environment Variables:
   ```
   DATABASE_URL=libsql://ucp-xxx.turso.io?authToken=eyJ...
   JWT_SECRET=(openssl rand -base64 48)
   API_KEY_HASH_SECRET=(openssl rand -base64 32)
   INTERNAL_API_TOKEN=(openssl rand -base64 32)
   REALTIME_GATEWAY_URL=https://your-gateway.up.railway.app
   ```
4. Deploy ✅

### 3. Realtime Gateway (Railway)
1. اذهب إلى https://railway.app → New Project → Deploy from GitHub
2. Root Directory: `mini-services/realtime-gateway`
3. أضف نفس Environment Variables (DATABASE_URL هو نفسه Turso URL)
4. Generate Domain → انسخ URL
5. عُد إلى Vercel وحدّث `REALTIME_GATEWAY_URL`

### 4. تهيئة قاعدة البيانات
```bash
# محلياً مع DATABASE_URL الخاص بـ Turso
DATABASE_URL="libsql://ucp-xxx.turso.io?authToken=eyJ..." bun run db:push

# ثم Seed
curl -X POST https://your-app.vercel.app/api/dashboard/seed?force=true
```

🎉 **المنصة جاهزة للإنتاج!**

> 📖 **دليل مفصل**: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🛠 الخدمات

تم تنفيذ 5 خدمات كاملة في النسخة الحالية:

### 1. Identity Service
إدارة Tenants، Projects، Users، API Keys (مع scopes)، End Users، Devices، Provider Configs، Audit Logs.

### 2. Notification Service
إرسال متعدد القنوات مع تتبع التسليم لكل مستلم، idempotency keys، أولويات، جدولة.

### 3. Realtime Gateway
Socket.io server منفصل للـ WebSocket connections، مع Presence tracking و Push HTTP API داخلي.
**يستخدم Turso (libSQL) في الإنتاج و SQLite محلياً في التطوير** (نفس الـ codebase، نفس الـ schema).

### 4. Event Bus
نشر واشتراك الأحداث بين الخدمات + استمرارها في DB للـ audit و replay.

### 5. Presence Service
تتبع حالة المستخدمين (online / away / offline) عبر الـ Gateway.

---

## 🚀 البدء السريع (Local Dev)

### المتطلبات
- Node.js 18+ أو Bun
- npm / bun / pnpm

### التثبيت

```bash
# استنساخ المشروع
git clone https://github.com/elmoorx0/ucp-platform.git
cd ucp-platform

# تثبيت الـ dependencies
bun install

# تثبيت dependencies للـ Gateway
cd mini-services/realtime-gateway && bun install && cd ../..

# إنشاء ملف .env
cp .env.example .env
```

### التشغيل

```bash
# 1. مزامنة قاعدة البيانات (SQLite محلي)
bun run db:push

# 2. تشغيل الـ Realtime Gateway (في terminal منفصل)
bun run gateway
# Gateway يعمل على http://localhost:3003

# 3. تشغيل Next.js (في terminal آخر)
bun run dev
# Next.js يعمل على http://localhost:3000
```

### الدخول للـ Dashboard

1. افتح `http://localhost:3000` في المتصفح
2. اضغط على **"Click here to seed demo data"**
3. سجّل الدخول بـ:
   - **Email**: `admin@ucp.local`
   - **Password**: `ucp-admin-2026`

---

## 📡 REST API

### المصادقة

استخدم API Key في الـ header:
```http
x-api-key: ucp_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

أو في الـ Authorization header:
```http
Authorization: Bearer ucp_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Endpoints الأساسية

#### إرسال إشعار
```http
POST /api/v1/notifications
Content-Type: application/json
x-api-key: ucp_live_xxx

{
  "channel": "inapp",  // push | email | inapp | webpush | multi
  "to": ["user-001", "user-002"],
  "title": "Hello from UCP",
  "body": "This notification was sent through UCP",
  "priority": "normal",  // low | normal | high
  "externalId": "unique-id-123"  // for idempotency
}
```

#### تسجيل جهاز
```http
POST /api/v1/devices
{
  "externalUserId": "user-001",
  "token": "firebase-token-or-endpoint",
  "platform": "android",  // android | ios | web
  "pushSubscription": {  // for webpush only
    "endpoint": "https://...",
    "keys": { "p256dh": "...", "auth": "..." }
  }
}
```

#### تسجيل مستخدم
```http
POST /api/v1/users
{
  "externalId": "user-001",
  "email": "user@example.com",
  "name": "John Doe",
  "tags": ["vip", "beta"]
}
```

#### قائمة الإشعارات
```http
GET /api/v1/notifications?page=1&status=sent
```

#### Broadcast عبر Realtime
```http
POST /api/v1/realtime
{
  "channel": "orders",
  "event": "order.created",
  "payload": { "orderId": "123" }
}
```

### Endpoints الكاملة

| Method | Endpoint | الوصف |
|--------|----------|--------|
| `POST` | `/api/v1/notifications` | إرسال إشعار |
| `GET` | `/api/v1/notifications` | قائمة الإشعارات |
| `GET` | `/api/v1/notifications/:id` | تفاصيل إشعار |
| `POST` | `/api/v1/notifications/:id/cancel` | إلغاء إشعار |
| `POST` | `/api/v1/notifications/send-template` | إرسال من قالب |
| `POST` | `/api/v1/devices` | تسجيل جهاز |
| `GET` | `/api/v1/devices` | قائمة الأجهزة |
| `POST` | `/api/v1/users` | تسجيل مستخدم |
| `GET` | `/api/v1/users` | قائمة المستخدمين |
| `GET` | `/api/v1/projects` | معلومات المشروع |
| `GET` | `/api/v1/stats` | إحصائيات |
| `GET` | `/api/v1/events` | سجل الأحداث |
| `GET` | `/api/v1/presence` | حالة الاتصال |
| `GET/POST` | `/api/v1/providers` | إعداد Providers |
| `POST` | `/api/v1/realtime` | Broadcast |
| `GET` | `/api/v1/channels` | قائمة القنوات |
| `GET` | `/api/v1/templates` | قائمة القوالب |
| `POST` | `/api/v1/webhooks/test` | اختبار الـ webhook |
| `GET` | `/api/docs` | مواصفات OpenAPI (Swagger) |
| `GET` | `/api/health` | فحص صحة النظام |

### توثيق OpenAPI (Swagger)

مواصفات OpenAPI 3.0 متاحة على `/api/docs`. يمكن استيرادها مباشرة في:
- [Swagger UI](https://petstore.swagger.io/) — الصق رابط `/api/docs`
- [Postman](https://www.postman.com/) — Import → Link → الصق الرابط
- [Insomnia](https://insomnia.rest/) — Import → From URL

### Rate Limiting

كل API key له حد افتراضي 1000 طلب/دقيقة. الاستجابات تتضمن headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1784432400
```

عند تجاوز الحد، الـ API يُرجع `429 Too Many Requests` مع header `Retry-After`.

### Notification Templates

قوالب جاهزة مع دعم متعدد اللغات:

| Template | الوصف | اللغات |
|----------|--------|--------|
| `welcome` | ترحيب بمستخدم جديد | en, ar, fr |
| `order_shipped` | تم شحن الطلب | en, ar |
| `otp` | رمز تحقق | en, ar |
| `password_reset` | إعادة تعيين كلمة المرور | en, ar |
| `new_message` | رسالة جديدة | en, ar |
| `payment_succeeded` | نجح الدفع | en, ar |
| `payment_failed` | فشل الدفع | en, ar |

استخدام:
```http
POST /api/v1/notifications/send-template
{
  "template": "welcome",
  "variables": { "name": "Alice", "appName": "MyApp" },
  "locale": "ar",
  "to": ["user-001"],
  "channel": "inapp"
}
```

### Webhook Delivery Receipts

عند تسليم إشعار، يتم إرسال POST لمشروعك (لو configured `webhookUrl`):

```http
POST /your-webhook-url
Content-Type: application/json
X-UCP-Signature: sha256=abc123...
X-UCP-Event: notification.delivered

{
  "event": "notification.delivered",
  "timestamp": "2026-07-20T12:00:00.000Z",
  "data": {
    "notificationId": "cmrr8...",
    "targetId": "cmrr8...",
    "projectId": "cmrr8...",
    "channel": "inapp",
    "status": "delivered",
    "endUserId": "cmrr8...",
    "providerMessageId": "inapp_abc123",
    "error": null,
    "attempts": 1
  }
}
```

التحقق من التوقيع:
```typescript
import { createHmac } from 'crypto'

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
  return expected === signature  // Use constant-time comparison in production
}
```

### Automatic Retries

الإشعارات الفاشلة تُعاد تلقائياً مع exponential backoff:

| المحاولة | التأخير |
|----------|---------|
| 1 | فوري |
| 2 | 30 ثانية |
| 3 | 2 دقيقة |
| 4 | 10 دقائق |
| 5 | 1 ساعة |

يتم تشغيل الـ retry عبر **Vercel Cron** (كل 5 دقائق) يستدعي `/api/internal/retry`.

---

## ⚡ Realtime Gateway

الـ Gateway يعمل كـ mini-service منفصل باستخدام Bun + Socket.io. يدعم **كلاً من SQLite المحلي (للتطوير) و Turso libSQL (للإنتاج)** عبر نفس الـ codebase ونفس الـ Prisma schema.

### الاتصال من العميل

```typescript
import { io } from 'socket.io-client'

// للإنتاج: استخدم URL الخاص بالـ Gateway على Railway/Render
const GATEWAY_URL = process.env.NODE_ENV === 'production'
  ? 'https://your-gateway.up.railway.app'
  : 'http://localhost:3003'

const socket = io(GATEWAY_URL, {
  auth: {
    apiKey: 'ucp_live_xxx',
    userId: 'user-001'
  }
})

socket.on('connect', () => console.log('Connected'))
socket.on('inapp:notification', (data) => {
  console.log('Notification:', data.title, data.body)
})

// اشتراك في قناة
socket.emit('channel:subscribe', 'orders')

// استقبال رسائل القناة
socket.on('message', (data) => console.log(data))

// إرسال رسالة للقناة
socket.emit('message', {
  channel: 'orders',
  event: 'order.created',
  payload: { orderId: '123' }
})

// تتبع Presence
socket.emit('presence:watch')
socket.on('presence:update', (data) => {
  console.log(`${data.userId} is ${data.status}`)
})
```

### Architecture (Push-based, No Polling)

```
Next.js API  ──HTTP POST──►  Gateway  ──Socket.io──►  Connected Clients
     │                            │
     │                            └─ In-memory presence
     └─ Persist to DB             └─ Forward to subscribers
```

الـ Gateway يقدم:
- `POST /internal/push` — دفع فوري للرسائل من Next.js API
- `GET /internal/presence` — استعلام حالة الاتصال
- `GET /health` — فحص صحة الخدمة

---

## 🔌 Provider Abstraction

كل provider يطبّق `BaseProvider` abstract class. لإضافة provider جديد، أنشئ ملفاً واحداً:

```typescript
// src/lib/providers/my-provider.ts
import { BaseProvider } from './base'
import type { ProviderName, ProviderCapabilities, SendRequest, SendResult } from '@/lib/types'

export class MyProvider extends BaseProvider {
  readonly name: ProviderName = 'my_provider' as ProviderName
  readonly displayName = 'My Custom Provider'
  readonly capabilities: ProviderCapabilities = {
    channels: ['push'],
    supportsBatch: false,
    supportsTemplate: false,
    supportsScheduled: false,
    maxRatePerSecond: 100,
  }

  protected async onValidateCredentials(): Promise<boolean> {
    return true
  }

  async send(request: SendRequest): Promise<SendResult> {
    return { success: true, providerMessageId: 'xxx' }
  }
}
```

ثم سجّله في `src/lib/providers/registry.ts`.

### Providers المتوفرة

| Provider | القنوات | الحالة |
|----------|---------|--------|
| **FCM** (Firebase Cloud Messaging) | Push (Android/iOS/Web) | ✅ مع وضع محاكاة |
| **Email SMTP** | Email | ✅ مع قالب HTML احترافي |
| **Web Push** (VAPID) | Web Push | ✅ |
| **In-App** | In-App (Realtime) | ✅ يعمل بالكامل |
| OneSignal | Push | 🚧 Stub جاهز للتطبيق |
| Twilio | SMS | 🚧 Stub جاهز للتطبيق |

---

## 🖥 لوحة التحكم

Dashboard شامل على `/` يحتوي على:

- **Overview** — إحصائيات + charts (status, channel breakdown)
- **Projects** — إدارة المشاريع
- **API Keys** — إنشاء/إلغاء المفاتيح مع scopes تفصيلية
- **Notifications** — قائمة + تفاصيل التسليم لكل مستلم
- **Send** — composer لإرسال الإشعارات مع preview مباشر
- **Providers** — تكوين الـ providers مع health check
- **End Users** — قائمة المستخدمين المسجلين
- **Events** — سجل الـ Event Bus
- **Audit Log** — سجل كل العمليات
- **Realtime Monitor** — اختبار الاتصال المباشر + live events

---

## 🏭 النشر الإنتاجي

### دليل مفصل

راجع **[DEPLOYMENT.md](DEPLOYMENT.md)** للحصول على دليل كامل خطوة بخطوة يشمل:

- ✅ إنشاء قاعدة بيانات Turso (SQLite سحابي مجاني)
- ✅ نشر Next.js على Vercel مع كل Environment Variables
- ✅ نشر Realtime Gateway على Railway / Render / Fly.io
- ✅ Dockerfile جاهز + railway.toml + render.yaml
- ✅ التحقق من النشر + Troubleshooting
- ✅ تقدير التكاليف (Free tier: $0/mo)

### لماذا SQLite + Turso؟

| الميزة | SQLite (محلي) | Turso (إنتاج) |
|--------|---------------|----------------|
| **Schema** | نفس Prisma schema | نفس Prisma schema |
| **URL format** | `file:./db/custom.db` | `libsql://xxx.turso.io?authToken=...` |
| **Connection** | Local file | HTTP (serverless-friendly) |
| **التكلفة** | مجاني | مجاني (9GB, 1B reads/mo) |
| **Serverless** | ❌ لا يعمل على Vercel | ✅ يدعم Vercel بـ كامل |
| **Edge replicas** | ❌ | ✅ (low latency) |
| **Multi-region** | ❌ | ✅ |

> **الخلاصة**: نفس الـ codebase، نفس الـ schema — فقط غيّر `DATABASE_URL` من `file:` إلى `libsql://` للإنتاج.

### الأهداف المدعومة

| المكون | المنصات المدعومة |
|--------|------------------|
| **Next.js App** | Vercel (موصى به)، Netlify، Self-hosted (Docker) |
| **Realtime Gateway** | Railway، Render، Fly.io، DigitalOcean، Self-hosted (Docker) |
| **Database** | SQLite (محلي)، Turso (إنتاج)، أي libSQL-compatible |

### متغيرات البيئة المطلوبة للإنتاج

راجع **[.env.example](.env.example)** للقائمة الكاملة.

---

## 📦 بنية المشروع

```
ucp-platform/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/              # REST API للـ clients
│   │   │   │   ├── notifications/
│   │   │   │   │   ├── send-template/  # إرسال من قالب
│   │   │   │   │   └── [id]/cancel/
│   │   │   │   ├── devices/
│   │   │   │   ├── users/
│   │   │   │   ├── projects/
│   │   │   │   ├── providers/
│   │   │   │   ├── events/
│   │   │   │   ├── presence/
│   │   │   │   ├── realtime/
│   │   │   │   ├── stats/
│   │   │   │   ├── channels/
│   │   │   │   ├── templates/        # قوالب الإشعارات
│   │   │   │   └── webhooks/test/    # اختبار webhook
│   │   │   ├── dashboard/       # API للوحة التحكم
│   │   │   ├── internal/retry/  # Vercel Cron endpoint
│   │   │   ├── docs/            # OpenAPI/Swagger spec
│   │   │   └── health/
│   │   ├── page.tsx             # Dashboard SPA
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   └── dashboard/           # Dashboard views
│   └── lib/
│       ├── adapters/            # Event Bus adapter
│       ├── middleware/          # Auth + rate-limit middleware
│       ├── providers/           # Notification providers
│       ├── services/            # Business logic
│       │   ├── identity.ts
│       │   ├── notification.ts
│       │   ├── eventbus.ts
│       │   ├── presence.ts
│       │   ├── templates.ts     # قوالب الإشعارات + i18n
│       │   ├── webhook.ts       # Webhook delivery receipts
│       │   └── retry.ts         # Exponential backoff retries
│       ├── types/               # TypeScript types
│       ├── crypto.ts            # JWT + API Key + password hashing
│       ├── db.ts                # Prisma client (SQLite + Turso)
│       ├── gateway-client.ts    # HTTP client للـ Gateway
│       └── dashboard-api.ts     # API client للـ Dashboard
├── sdk/js/                      # JavaScript Client SDK
│   ├── index.ts                 # Main entry
│   ├── package.json
│   └── README.md
├── prisma/
│   └── schema.prisma            # Database schema (SQLite/Turso — same)
├── mini-services/
│   └── realtime-gateway/        # Socket.io gateway (Bun)
│       ├── index.ts             # Main entry (SQLite + Turso via libSQL)
│       ├── Dockerfile           # For Railway/Render/Fly.io
│       ├── railway.toml         # Railway config
│       ├── render.yaml          # Render blueprint
│       ├── package.json
│       └── tsconfig.json
├── .github/workflows/
│   ├── ci.yml                   # Lint + type-check + build
│   └── deploy.yml               # Vercel deployment
├── vercel.json                  # Vercel config + Cron jobs
├── .env.example                 # Environment variables template
├── DEPLOYMENT.md                # Detailed deployment guide
├── Caddyfile                    # Reverse proxy config (for self-hosting)
└── package.json
```

---

## 📚 JavaScript SDK

توفّر مكتبة `ucp-platform-sdk` واجهة بسيطة للاستخدام من المتصفح أو Node.js:

### التثبيت

```bash
npm install ucp-platform-sdk
# أو
bun add ucp-platform-sdk
```

### الاستخدام

```typescript
import { UCP } from 'ucp-platform-sdk'

const ucp = new UCP({
  apiUrl: 'https://your-app.vercel.app',
  gatewayUrl: 'https://your-gateway.up.railway.app',
  apiKey: 'ucp_live_xxx',
})

// إرسال إشعار
await ucp.notifications.send({
  channel: 'inapp',
  to: ['user-001'],
  title: 'Hello',
  body: 'World',
})

// إرسال من قالب مع متغيرات
await ucp.notifications.sendTemplate('welcome', { name: 'Alice' }, {
  to: ['user-001'],
  locale: 'ar',
})

// تسجيل جهاز
await ucp.devices.register({
  externalUserId: 'user-001',
  token: 'firebase-token',
  platform: 'android',
})

// الاتصال بالـ Realtime
const socket = ucp.realtime.connect('user-001')
socket.on('inapp:notification', (data) => console.log('Got notif:', data))
socket.emit('channel:subscribe', 'orders')

// التحقق من webhook signature (في خادمك)
const isValid = ucp.webhooks.verifySignature(payload, signature, secret)
```

راجع **[sdk/js/README.md](sdk/js/README.md)** للتوثيق الكامل.

---

## 🤝 المساهمة

1. Fork المشروع
2. أنشئ branch للميزة الجديدة (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push للـ branch (`git push origin feature/amazing-feature`)
5. افتح Pull Request

### CI/CD

يحتوي المشروع على GitHub Actions workflows:

- **`.github/workflows/ci.yml`**: يُشغّل عند كل push/PR:
  - ✅ ESLint check
  - ✅ TypeScript type-check
  - ✅ Next.js build
  - ✅ Docker build للـ Gateway
  - ✅ Smoke test للـ Gateway

- **`.github/workflows/deploy.yml`**: يُشغّل عند push لـ `main`:
  - 🚀 نشر تلقائي على Vercel (يتطلب إعداد `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` كـ GitHub secrets)

---

## 📄 الترخيص

MIT License — راجع ملف [LICENSE](LICENSE) للتفاصيل.

---

## 🙏 شكر وتقدير

- [Next.js](https://nextjs.org/)
- [Prisma](https://www.prisma.io/)
- [Socket.io](https://socket.io/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Bun](https://bun.sh/)
- [Vercel](https://vercel.com/)
- [Turso](https://turso.tech/) — SQLite in the cloud
- [Railway](https://railway.app/)

---

**صُنع بعناية كمنصة CPaaS جاهزة للإنتاج على Vercel + Turso** 🚀

