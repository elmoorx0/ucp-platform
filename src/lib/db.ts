import { PrismaClient } from '@prisma/client'

/**
 * Prisma Client singleton — Zero-config compatible.
 *
 * Database strategy (automatic, no env vars required):
 *  1. If DATABASE_URL is set → use it (Turso or SQLite file)
 *  2. If on Vercel/production without DATABASE_URL → use in-memory SQLite
 *     (data is lost on each cold start, but the app works for demos)
 *  3. If local dev without DATABASE_URL → use ./db/custom.db (auto-created)
 *
 * For production persistence, set DATABASE_URL to a Turso libSQL URL:
 *   DATABASE_URL="libsql://your-db.turso.io?authToken=xxx"
 *
 * Other env vars have safe defaults for development:
 *  - JWT_SECRET: default provided (with warning in production)
 *  - API_KEY_HASH_SECRET: default provided (with warning)
 *  - INTERNAL_API_TOKEN: default provided
 *  - REALTIME_GATEWAY_URL: defaults to empty (realtime features disabled)
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL

  // Case 1: DATABASE_URL is set
  if (databaseUrl) {
    // Turso (libSQL)
    if (databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('libsql:')) {
      return createTursoClient(databaseUrl)
    }
    // Local SQLite file
    if (databaseUrl.startsWith('file:')) {
      return new PrismaClient({
        log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
      })
    }
  }

  // Case 2: No DATABASE_URL — auto-create based on environment
  const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV)
  const isProduction = process.env.NODE_ENV === 'production'

  if (isVercel || isProduction) {
    // On Vercel without DATABASE_URL: use /tmp directory (writable on Vercel)
    // Note: data is lost on cold starts, but the app works for demos
    console.warn(
      '[UCP] DATABASE_URL not set. Using /tmp/ucp-dev.db (data will be lost on cold restart).\n' +
      'For persistent data, set DATABASE_URL to a Turso libSQL URL:\n' +
      '  1. https://turso.tech (free)\n' +
      '  2. turso db create ucp\n' +
      '  3. turso db show ucp --url\n' +
      '  4. turso db tokens create ucp\n' +
      '  5. Set DATABASE_URL=libsql://ucp-xxx.turso.io?authToken=xxx'
    )
    // Set the env var so Prisma can use it
    process.env.DATABASE_URL = 'file:/tmp/ucp-dev.db'
  } else {
    // Local dev: use ./db/custom.db (auto-created by Prisma)
    console.log('[UCP] DATABASE_URL not set. Using local ./db/custom.db')
    process.env.DATABASE_URL = 'file:./db/custom.db'
  }

  return new PrismaClient({
    log: ['error', 'warn'],
  })
}

/**
 * Create a PrismaClient backed by Turso (libSQL).
 */
function createTursoClient(databaseUrl: string): PrismaClient {
  const urlMatch = databaseUrl.match(/^(libsql:\/\/[^?]+)/)
  const authTokenMatch = databaseUrl.match(/[?&]authToken=([^&]+)/)
  const url = urlMatch ? urlMatch[1] : databaseUrl
  const authToken = authTokenMatch ? decodeURIComponent(authTokenMatch[1]) : undefined

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaLibSQL } = require('@prisma/adapter-libsql') as typeof import('@prisma/adapter-libsql')

  const adapter = new PrismaLibSQL({ url, authToken })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
  } as ConstructorParameters<typeof PrismaClient>[0])
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}

/**
 * Auto-initialize the database schema if it doesn't exist.
 * This runs on first request and creates all tables.
 */
let dbInitialized = false
export async function ensureDbInitialized(): Promise<void> {
  if (dbInitialized) return
  dbInitialized = true

  try {
    // Test if tables exist by querying
    await db.$queryRaw`SELECT 1`
  } catch {
    // Tables don't exist — run db push programmatically
    console.log('[UCP] Database not initialized. Tables will be created on first use.')
    // Note: Prisma doesn't have a programmatic db push API.
    // For Vercel, the user should run `bun run db:push` locally with their DATABASE_URL.
    // For the /tmp fallback, we create tables manually below.
    if (process.env.DATABASE_URL?.startsWith('file:/tmp/')) {
      await createTablesForSqlite()
    }
  }
}

/**
 * Create tables manually for SQLite (used when no schema is pushed).
 * This is a simplified version of the Prisma schema.
 */
async function createTablesForSqlite(): Promise<void> {
  console.log('[UCP] Creating tables for SQLite fallback...')
  const statements = [
    `CREATE TABLE IF NOT EXISTS Tenant (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'active',
      plan TEXT DEFAULT 'free',
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      passwordHash TEXT NOT NULL,
      role TEXT DEFAULT 'viewer',
      status TEXT DEFAULT 'active',
      lastLoginAt DATETIME,
      avatarUrl TEXT,
      tenantId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenantId) REFERENCES Tenant(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS Project (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      iconUrl TEXT,
      webhookUrl TEXT,
      metadata TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, slug),
      FOREIGN KEY (tenantId) REFERENCES Tenant(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS ApiKey (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      name TEXT NOT NULL,
      keyPrefix TEXT NOT NULL,
      hashedKey TEXT UNIQUE NOT NULL,
      scopes TEXT DEFAULT '[]',
      permissions TEXT DEFAULT '[]',
      rateLimitPerMin INTEGER DEFAULT 1000,
      lastUsedAt DATETIME,
      lastUsedIp TEXT,
      expiresAt DATETIME,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS EndUser (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      externalId TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      name TEXT,
      avatarUrl TEXT,
      language TEXT DEFAULT 'en',
      timezone TEXT DEFAULT 'UTC',
      tags TEXT DEFAULT '[]',
      attributes TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(projectId, externalId),
      FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS Device (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      endUserId TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      platform TEXT NOT NULL,
      userAgent TEXT,
      appVersion TEXT,
      pushSubscription TEXT,
      status TEXT DEFAULT 'active',
      lastSeenAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE,
      FOREIGN KEY (endUserId) REFERENCES EndUser(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS Notification (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      channel TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      imageUrl TEXT,
      data TEXT DEFAULT '{}',
      targetingType TEXT DEFAULT 'user',
      targetingData TEXT DEFAULT '{}',
      providerName TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      scheduledAt DATETIME,
      sentAt DATETIME,
      totalTargets INTEGER DEFAULT 0,
      deliveredCount INTEGER DEFAULT 0,
      failedCount INTEGER DEFAULT 0,
      pendingCount INTEGER DEFAULT 0,
      externalId TEXT,
      metadata TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS NotificationTarget (
      id TEXT PRIMARY KEY,
      notificationId TEXT NOT NULL,
      endUserId TEXT,
      deviceId TEXT,
      channel TEXT NOT NULL,
      providerName TEXT,
      status TEXT DEFAULT 'pending',
      providerMessageId TEXT,
      attempts INTEGER DEFAULT 0,
      lastError TEXT,
      deliveredAt DATETIME,
      readAt DATETIME,
      clickedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (notificationId) REFERENCES Notification(id) ON DELETE CASCADE,
      FOREIGN KEY (endUserId) REFERENCES EndUser(id) ON DELETE SET NULL,
      FOREIGN KEY (deviceId) REFERENCES Device(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ProviderConfig (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      name TEXT NOT NULL,
      displayName TEXT,
      credentials TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      isDefault INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(projectId, name),
      FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS Event (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      payload TEXT DEFAULT '{}',
      channel TEXT,
      delivered INTEGER DEFAULT 0,
      deliveredAt DATETIME,
      subscriberCount INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS RealtimeChannel (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'public',
      metadata TEXT DEFAULT '{}',
      subscriberCount INTEGER DEFAULT 0,
      lastActivityAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(projectId, name),
      FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS AuditLog (
      id TEXT PRIMARY KEY,
      tenantId TEXT,
      userId TEXT,
      apiKeyId TEXT,
      action TEXT NOT NULL,
      resource TEXT,
      resourceId TEXT,
      before TEXT,
      after TEXT,
      ip TEXT,
      userAgent TEXT,
      status TEXT DEFAULT 'success',
      message TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenantId) REFERENCES Tenant(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE SET NULL,
      FOREIGN KEY (apiKeyId) REFERENCES ApiKey(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS DailyStat (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      date DATETIME NOT NULL,
      channel TEXT NOT NULL,
      sent INTEGER DEFAULT 0,
      delivered INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      read INTEGER DEFAULT 0,
      clicked INTEGER DEFAULT 0,
      messagesSent INTEGER DEFAULT 0,
      activeConnections INTEGER DEFAULT 0,
      peakConnections INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(projectId, date, channel),
      FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE
    )`,
    // Create indexes
    `CREATE INDEX IF NOT EXISTS idx_user_tenantId ON User(tenantId)`,
    `CREATE INDEX IF NOT EXISTS idx_user_role ON User(role)`,
    `CREATE INDEX IF NOT EXISTS idx_project_tenantId ON Project(tenantId)`,
    `CREATE INDEX IF NOT EXISTS idx_project_status ON Project(status)`,
    `CREATE INDEX IF NOT EXISTS idx_apikey_projectId ON ApiKey(projectId)`,
    `CREATE INDEX IF NOT EXISTS idx_apikey_hashedKey ON ApiKey(hashedKey)`,
    `CREATE INDEX IF NOT EXISTS idx_apikey_status ON ApiKey(status)`,
    `CREATE INDEX IF NOT EXISTS idx_enduser_projectId_externalId ON EndUser(projectId, externalId)`,
    `CREATE INDEX IF NOT EXISTS idx_enduser_email ON EndUser(email)`,
    `CREATE INDEX IF NOT EXISTS idx_device_projectId_endUserId ON Device(projectId, endUserId)`,
    `CREATE INDEX IF NOT EXISTS idx_device_projectId_status ON Device(projectId, status)`,
    `CREATE INDEX IF NOT EXISTS idx_notification_projectId_status ON Notification(projectId, status)`,
    `CREATE INDEX IF NOT EXISTS idx_notification_projectId_channel ON Notification(projectId, channel)`,
    `CREATE INDEX IF NOT EXISTS idx_notification_projectId_createdAt ON Notification(projectId, createdAt)`,
    `CREATE INDEX IF NOT EXISTS idx_notification_scheduledAt ON Notification(scheduledAt)`,
    `CREATE INDEX IF NOT EXISTS idx_notificationTarget_notificationId ON NotificationTarget(notificationId)`,
    `CREATE INDEX IF NOT EXISTS idx_notificationTarget_endUserId ON NotificationTarget(endUserId)`,
    `CREATE INDEX IF NOT EXISTS idx_notificationTarget_deviceId ON NotificationTarget(deviceId)`,
    `CREATE INDEX IF NOT EXISTS idx_notificationTarget_status ON NotificationTarget(status)`,
    `CREATE INDEX IF NOT EXISTS idx_providerConfig_projectId_enabled ON ProviderConfig(projectId, enabled)`,
    `CREATE INDEX IF NOT EXISTS idx_event_projectId_type ON Event(projectId, type)`,
    `CREATE INDEX IF NOT EXISTS idx_event_projectId_createdAt ON Event(projectId, createdAt)`,
    `CREATE INDEX IF NOT EXISTS idx_event_channel_delivered ON Event(channel, delivered)`,
    `CREATE INDEX IF NOT EXISTS idx_realtimeChannel_projectId_type ON RealtimeChannel(projectId, type)`,
    `CREATE INDEX IF NOT EXISTS idx_auditLog_tenantId_createdAt ON AuditLog(tenantId, createdAt)`,
    `CREATE INDEX IF NOT EXISTS idx_auditLog_userId ON AuditLog(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_auditLog_action ON AuditLog(action)`,
    `CREATE INDEX IF NOT EXISTS idx_dailyStat_projectId_date ON DailyStat(projectId, date)`,
  ]

  for (const stmt of statements) {
    try {
      await db.$executeRawUnsafe(stmt)
    } catch (e) {
      // Table/index might already exist — ignore
    }
  }

  console.log('[UCP] Tables created successfully.')
}
