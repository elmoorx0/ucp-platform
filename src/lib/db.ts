import { PrismaClient } from '@prisma/client'

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
  // We load these dependencies dynamically so they're only required when
  // actually using Turso. This avoids build errors when @libsql/client is
  // not installed in dev environments that only use SQLite files.
  if (databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('libsql:')) {
    return createTursoClient(databaseUrl)
  }

  // Local SQLite file (development)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  })
}

/**
 * Create a PrismaClient backed by Turso (libSQL).
 * Dependencies are loaded dynamically to avoid bundling them when not needed.
 */
function createTursoClient(databaseUrl: string): PrismaClient {
  // Parse URL and authToken
  const urlMatch = databaseUrl.match(/^(libsql:\/\/[^?]+)/)
  const authTokenMatch = databaseUrl.match(/[?&]authToken=([^&]+)/)
  const url = urlMatch ? urlMatch[1] : databaseUrl
  const authToken = authTokenMatch ? decodeURIComponent(authTokenMatch[1]) : undefined

  // Dynamic imports — only executed when Turso is actually used
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaLibSQL } = require('@prisma/adapter-libsql') as typeof import('@prisma/adapter-libsql')

  // PrismaLibSQL constructor accepts a Config object (url + authToken), NOT a Client instance.
  // This is the API in @prisma/adapter-libsql 6.x.
  const adapter = new PrismaLibSQL({ url, authToken })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  } as ConstructorParameters<typeof PrismaClient>[0])
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

// Cache on globalThis in all environments (not just dev) for serverless reuse
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}
