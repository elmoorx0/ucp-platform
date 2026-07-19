# 🚀 Universal Communication Platform (UCP)

> **Communication as a Service (CPaaS)** — منصة اتصالات موحدة، مستقلة، متعددة المستأجرين (Multi-Tenant)، تعمل كطبقة وسيطة بين تطبيقاتك والمستخدمين.

[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-blue.svg)](https://www.prisma.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-black.svg)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📖 الفهرد

- [نظرة عامة](#نظرة-عامة)
- [المميزات](#المميزات)
- [البنية التقنية](#البنية-التقنية)
- [الخدمات](#الخدمات)
- [البدء السريع](#البدء-السريع)
- [REST API](#rest-api)
- [Realtime Gateway](#realtime-gateway)
- [Provider Abstraction](#provider-abstraction)
- [لوحة التحكم](#لوحة-التحكم)
- [الإنتاج](#الإنتاج)

---

## 🎯 نظرة عامة

بدلاً من أن يقوم كل مشروع بإدارة الإشعارات أو WebSocket أو البريد الإلكتروني بنفسه، فإنه يرسل طلباً واحداً إلى UCP عبر REST API، وتتولى UCP تنفيذ العملية بالكامل باستخدام المزود (Provider) المناسب.

```
أي مشروع (PHP / Next.js / Rust / Laravel / Flutter ...)
            │
            │ REST API
            ▼
Universal Communication Platform
            │
 ┌──────────┼──────────┐
 │          │          │
Notification  Realtime  Event Bus
 │          │          │
 ├── FCM
 ├── Email SMTP
 ├── Web Push
 ├── In-App
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

---

## 🏗 البنية التقنية

| المكون | التقنية |
|--------|---------|
| **Frontend & API** | Next.js 16 (App Router) + TypeScript 5 |
| **Database** | Prisma ORM + SQLite (dev) / PostgreSQL (production) |
| **Realtime** | Socket.io + Bun (mini-service منفصل) |
| **Caching** | In-memory (dev) / Redis (production) |
| **UI** | Tailwind CSS 4 + shadcn/ui + Recharts |
| **Auth** | JWT (Dashboard) + API Keys (Clients) |
| **Process Runtime** | Bun (للـ Gateway) + Node.js (للـ Next.js) |

---

## 🛠 الخدمات

تم تنفيذ 5 خدمات كاملة في النسخة الحالية:

### 1. Identity Service
إدارة Tenants، Projects، Users، API Keys (مع scopes)، End Users، Devices، Provider Configs، Audit Logs.

### 2. Notification Service
إرسال متعدد القنوات مع تتبع التسليم لكل مستلم، idempotency keys، أولويات، جدولة.

### 3. Realtime Gateway
Socket.io server منفصل للـ WebSocket connections، مع Presence tracking و Push HTTP API داخلي.

### 4. Event Bus
نشر واشتراك الأحداث بين الخدمات + استمرارها في DB للـ audit و replay.

### 5. Presence Service
تتبع حالة المستخدمين (online / away / offline) عبر الـ Gateway.

---

## 🚀 البدء السريع

### المتطلبات
- Node.js 18+ أو Bun
- npm / bun / pnpm

### التثبيت

```bash
# استنساخ المشروع
git clone https://github.com/USERNAME/ucp-platform.git
cd ucp-platform

# تثبيت الـ dependencies
bun install  # أو npm install

# تثبيت dependencies للـ Gateway
cd mini-services/realtime-gateway
bun install
cd ../..
```

### التشغيل

```bash
# 1. تشغيل الـ Realtime Gateway (في terminal منفصل)
cd mini-services/realtime-gateway
bun index.ts
# Gateway يعمل على http://localhost:3003

# 2. تشغيل Next.js (في terminal آخر)
bun run dev
# Next.js يعمل على http://localhost:3000

# 3. مزامنة قاعدة البيانات
bun run db:push
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

---

## ⚡ Realtime Gateway

الـ Gateway يعمل كـ mini-service منفصل على المنفذ 3003 باستخدام Bun + Socket.io.

### الاتصال من العميل

```typescript
import { io } from 'socket.io-client'

const socket = io('/?XTransformPort=3003', {
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
    // تحقق من الـ credentials
    return true
  }

  async send(request: SendRequest): Promise<SendResult> {
    // أرسل الإشعار عبر الـ provider
    return { success: true, providerMessageId: 'xxx' }
  }
}
```

ثم سجّله في `src/lib/providers/registry.ts`:

```typescript
const PROVIDER_FACTORIES: Record<ProviderName, () => Provider> = {
  // ... existing providers
  my_provider: () => new MyProvider(),
}
```

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

## 🏭 الإنتاج

### متغيرات البيئة المطلوبة

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/ucp"

# JWT
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"

# API Key hashing
API_KEY_HASH_SECRET="your-api-key-hash-secret"

# Internal API token (Next.js ↔ Gateway)
INTERNAL_API_TOKEN="your-internal-api-token"

# Gateway URL
REALTIME_GATEWAY_URL="http://gateway:3003"

# Redis (للـ multi-instance)
REDIS_URL="redis://localhost:6379"
```

### خطوات الإنتاج

1. **بدّل SQLite بـ PostgreSQL** في `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. **فعّل Redis** للـ Event Bus (multi-instance support)

3. **ثبّت الـ dependencies الحقيقية**:
   ```bash
   bun add firebase-admin nodemailer web-push
   ```

4. **شغّل الـ Gateway كـ systemd service** أو Docker container

5. **استخدم Nginx/Caddy** كـ reverse proxy مع TLS

### Docker (مستقبلاً)

```yaml
# docker-compose.yml (مثال)
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [db, redis, gateway]
  
  gateway:
    build: ./mini-services/realtime-gateway
    ports: ["3003:3003"]
    env_file: .env
  
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: ucp
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: ["pgdata:/var/lib/postgresql/data"]
  
  redis:
    image: redis:7-alpine
```

---

## 📁 بنية المشروع

```
ucp-platform/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/              # REST API للـ clients
│   │   │   │   ├── notifications/
│   │   │   │   ├── devices/
│   │   │   │   ├── users/
│   │   │   │   ├── projects/
│   │   │   │   ├── providers/
│   │   │   │   ├── events/
│   │   │   │   ├── presence/
│   │   │   │   ├── realtime/
│   │   │   │   ├── stats/
│   │   │   │   └── channels/
│   │   │   ├── dashboard/       # API للوحة التحكم
│   │   │   └── health/
│   │   ├── page.tsx             # Dashboard SPA
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   └── dashboard/           # Dashboard views
│   └── lib/
│       ├── adapters/            # Event Bus adapter
│       ├── middleware/          # Auth middleware
│       ├── providers/           # Notification providers
│       ├── services/            # Business logic
│       ├── types/               # TypeScript types
│       ├── crypto.ts            # JWT + API Key + password hashing
│       ├── gateway-client.ts    # HTTP client للـ Gateway
│       └── dashboard-api.ts     # API client للـ Dashboard
├── prisma/
│   └── schema.prisma            # Database schema (multi-tenant)
├── mini-services/
│   └── realtime-gateway/        # Socket.io gateway (Bun)
│       ├── index.ts
│       └── package.json
├── Caddyfile                    # Reverse proxy config
└── package.json
```

---

## 🤝 المساهمة

1. Fork المشروع
2. أنشئ branch للميزة الجديدة (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push للـ branch (`git push origin feature/amazing-feature`)
5. افتح Pull Request

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

---

**صُنع بعناية كمنصة CPaaS جاهزة للإنتاج** 🚀
