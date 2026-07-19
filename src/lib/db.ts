import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

/**
 * Prisma Client singleton — Vercel/serverless compatible.
 *
 * Database strategy:
 *  - Local dev: SQLite file (DATABASE_URL="file:./db/custom.db")
 *  - Production (Vercel): Turso libSQL (DATABASE_URL="libsql://...")
 *
 * Why singleton? In serverless environments (Vercel), each invocation may
 * spin up a new instance. We cache PrismaClient on `globalThis` to avoid
 * creating new DB connections on every hot-reload during dev, and to
 * reuse connections across serverless invocations when possible.
 *
 * For production on Vercel:
 *   1. Create a free Turso account: https://turso.tech
 *   2. Create a database
 *   3. Set DATABASE_URL="libsql://your-db.turso.io?authToken=your-token"
 *
 * Why Turso?
 *   - SQLite-compatible (same Prisma schema, no migration needed)
 *   - Serverless-friendly (HTTP-based, no connection pooling issues)
 *   - Free tier: 9GB, 500 databases, 1 billion reads/month
 *   - Edge-ready (low latency globally)
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || 'file:./db/custom.db'

  // If DATABASE_URL starts with "libsql://", use Turbo adapter (production)
  if (databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('libsql:')) {
    const authTokenMatch = databaseUrl.match(/[?&]authToken=([^&]+)/)
    const authToken = authTokenMatch ? decodeURIComponent(authTokenMatch[1]) : undefined
    const url = databaseUrl.split('?')[0]

    const libsql = createClient({
      url,
      authToken,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
    } as ConstructorParameters<typeof PrismaClient>[0])
  }

  // Local SQLite file (development)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

// Cache on globalThis in all environments (not just dev) for serverless reuse
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}
