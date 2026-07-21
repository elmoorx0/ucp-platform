# Changelog

All notable changes to UCP (Universal Communication Platform) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- 📱 React Native SDK
- 🌐 Dashboard UI i18n (Arabic/English)
- 📊 Advanced analytics (cohort analysis, funnel tracking)
- 🔐 OAuth2/SSO (Google, GitHub login)
- 📈 Grafana dashboard templates
- 🧪 E2E tests with Playwright

---

## [1.4.0] - 2026-07-20

### Added
- ⏰ **Scheduled Notifications** — schedule notifications for future delivery
  - New `scheduler` service processes due notifications
  - `POST /api/internal/scheduler` endpoint (Vercel Cron every minute)
  - `GET /api/v1/notifications/scheduled` to preview upcoming notifications
  - Atomic status transitions prevent duplicate processing
- 🔁 **Webhook Retry Queue** — automatic retry of failed webhook deliveries
  - Exponential backoff: 30min, 2h, 8h, 24h (5 attempts max)
  - `POST /api/internal/webhook-retry` endpoint (Vercel Cron every 30min)
  - `recordFailedWebhook()` helper for tracking
- 🔐 **API Key Rotation** — `POST /api/v1/api-keys/rotate`
  - Generates new key, invalidates old one
  - Preserves ID, name, scopes
  - Requires Dashboard JWT auth (not API key)
  - Tenant ownership verification
  - Invalidates provider cache
- 📊 **Prometheus Metrics** — `GET /api/metrics`
  - 13+ metrics in Prometheus text format
  - Compatible with Prometheus scrape config
  - Metrics: notifications, API keys, devices, projects, tenants, events, realtime
- 🐳 **Docker Compose** for local development
  - `docker-compose.yml` starts Next.js + Gateway with hot reload
  - `Dockerfile.dev` for both services (bun:1.1 base)
  - Shared `./db` volume
- 🧪 **Test Suite** (Vitest) — 31 tests, all passing
  - Tests for crypto (password hashing, API keys, JWT)
  - Tests for templates (i18n, variable interpolation)
  - Tests for retry (backoff schedule)
  - Tests for webhook signatures (sign, verify, tamper detection)
  - `bun run test` / `test:watch` / `test:ui` / `test:coverage`

### Fixed
- `retry.ts`: fixed `RETRY_DELAYS_SEC[0]=0` falsy bug — used `??` instead of `||`
  - Bug caused first retry to be scheduled 1 hour later instead of immediately
- `webhook.ts`: `verifySignature` now uses provided `secret` parameter
  - Previously ignored the secret and always used `INTERNAL_API_TOKEN`

### Changed
- `vercel.json`: added 3 cron jobs (scheduler, retry, webhook-retry)
- CI workflow now runs tests on every push/PR

---

## [1.3.0] - 2026-07-20

### Added
- 🔒 **Rate Limiting** (sliding window) — per-API-key limits
  - Default 1000 req/min, configurable per key
  - `X-RateLimit-*` headers on all responses
  - `429 Too Many Requests` with `Retry-After`
  - DB-backed (works in serverless without Redis)
- 📝 **Notification Templates** with i18n
  - 7 built-in templates: welcome, otp, order_shipped, password_reset, new_message, payment_succeeded, payment_failed
  - Multi-locale support: English, Arabic, French
  - Variable interpolation: `{{name}}`, `{{orderId}}`
  - `POST /api/v1/notifications/send-template`
  - `GET /api/v1/templates`
- 🔔 **Webhook Delivery Receipts**
  - Automatic POST to `project.webhookUrl` on delivery events
  - HMAC-SHA256 signature in `X-UCP-Signature` header
  - Constant-time signature verification
  - `POST /api/v1/webhooks/test`
- 🔁 **Automatic Retries** (exponential backoff)
  - 5 attempts: 0s, 30s, 2m, 10m, 1h
  - Skips non-retryable errors
  - Vercel Cron triggers `/api/internal/retry` every 5 minutes
- 📚 **OpenAPI 3.0 Documentation** — `GET /api/docs`
  - Full Swagger spec
  - Importable into Postman, Insomnia, Swagger UI
- 📦 **JavaScript Client SDK** — `sdk/js/` package
  - Full TypeScript types
  - Methods: notifications, devices, users, templates, realtime, webhooks, stats, presence
  - Socket.io integration
  - Webhook signature verification helper
- 🤖 **GitHub Actions CI/CD**
  - `ci.yml`: lint + type-check + build + Docker gateway smoke test
  - `deploy.yml`: auto-deploy to Vercel on push to main
- ⏰ **Vercel Cron** for retry processing (every 5 minutes)

---

## [1.2.0] - 2026-07-19

### Changed
- 🗄️ **Switched to SQLite-only** with Turso for production
  - Single `prisma/schema.prisma` (provider=sqlite)
  - `DATABASE_URL` format: `file:./db/custom.db` (local) or `libsql://...` (Turso)
  - Same Prisma schema for both modes
  - Added `@libsql/client` and `@prisma/adapter-libsql`
  - `src/lib/db.ts` auto-detects SQLite vs Turso from URL prefix

### Removed
- PostgreSQL support (simplified to SQLite/Turso only)
- `prisma/schema.sqlite.prisma` (no longer needed)
- `db:use-sqlite` / `db:use-postgres` scripts
- `pg` dependency

### Added
- Turso (libSQL) support for serverless SQLite
- Updated `DEPLOYMENT.md` with Turso step-by-step guide

---

## [1.1.0] - 2026-07-19

### Added
- 🐳 **Dockerfile** for Realtime Gateway (oven/bun base image)
- 🚂 **`railway.toml`** for Railway deployment
- 🌈 **`render.yaml`** blueprint for Render deployment
- 📄 **`vercel.json`** with Vercel build configuration
- 📖 **`DEPLOYMENT.md`** — step-by-step deployment guide
  - Neon/Vercel Postgres setup
  - Vercel deployment instructions
  - Railway/Render/Fly.io Gateway deployment
  - Troubleshooting guide
  - Cost estimation
- ⚙️ **`next.config.ts`** optimizations for Vercel
  - `outputFileTracingIncludes` for Prisma binary
  - `serverExternalPackages` for proper bundling
- 📦 **`package.json`** updates
  - `postinstall: prisma generate` (auto-runs on Vercel)
  - `vercel-build: prisma generate && next build`
- 🔧 **`src/lib/db.ts`** — PrismaClient globalized for serverless reuse

### Changed
- Default `prisma/schema.prisma` uses PostgreSQL (production-ready)
- README updated with Vercel-ready badges and quick deploy section
- Architecture diagram showing Next.js on Vercel + Gateway on Railway

---

## [1.0.0] - 2026-07-19

### Added
- 🎉 **Initial release** of UCP (Universal Communication Platform)
- 🏗 **Multi-tenant architecture** — Tenant, Project, User, ApiKey, EndUser, Device, Notification, ProviderConfig, Event, RealtimeChannel, AuditLog, DailyStat
- 🛠 **5 Core Services**:
  - **Identity Service** — Tenants, Projects, Users, API Keys, End Users, Devices, Provider Configs, Audit Logs
  - **Notification Service** — multi-channel with delivery tracking
  - **Realtime Gateway** — Socket.io + Presence (push-based, no polling)
  - **Event Bus** — cross-service pub/sub with persistence
  - **Presence Service** — online/away/offline tracking
- 🔌 **4 Notification Providers**:
  - FCM (Firebase Cloud Messaging) with simulation mode
  - Email SMTP with HTML template
  - Web Push (VAPID)
  - In-App (realtime via Gateway)
  - `BaseProvider` abstract class for adding new providers
- 📡 **REST API** (25+ endpoints):
  - `/api/v1/*` for clients (API Key auth + scopes)
  - `/api/dashboard/*` for dashboard UI (JWT auth)
- 🖥 **Dashboard UI** (10 views):
  - Overview with charts (Recharts)
  - Projects, API Keys, Notifications, Send, Providers
  - End Users, Events, Audit Log, Realtime Monitor
- 🔐 **Security**:
  - JWT (dashboard) + API Keys (clients) with scoped permissions
  - bcrypt-style password hashing (scrypt)
  - API key hashing with salt
  - Audit log for all operations
- 📊 **Prisma ORM** with SQLite (dev) / PostgreSQL (production)
- ⚡ **Realtime Gateway** as separate Bun service on port 3003
  - Push-based delivery (no polling)
  - Socket.io with auth middleware
  - Internal HTTP API for Next.js → Gateway communication
- 🎨 **UI** — Tailwind CSS 4 + shadcn/ui + Lucide icons
- 📦 **Vercel-ready** with proper configuration

---

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.x.x): Incompatible API changes
- **MINOR** (x.1.x): New features, backward-compatible
- **PATCH** (x.x.1): Bug fixes, backward-compatible

---

## Links

- [Releases](https://github.com/elmoorx0/ucp-platform/releases)
- [Tags](https://github.com/elmoorx0/ucp-platform/tags)
- [Compare versions](https://github.com/elmoorx0/ucp-platform/compare)

[Unreleased]: https://github.com/elmoorx0/ucp-platform/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/elmoorx0/ucp-platform/releases/tag/v1.4.0
[1.3.0]: https://github.com/elmoorx0/ucp-platform/releases/tag/v1.3.0
[1.2.0]: https://github.com/elmoorx0/ucp-platform/releases/tag/v1.2.0
[1.1.0]: https://github.com/elmoorx0/ucp-platform/releases/tag/v1.1.0
[1.0.0]: https://github.com/elmoorx0/ucp-platform/releases/tag/v1.0.0
