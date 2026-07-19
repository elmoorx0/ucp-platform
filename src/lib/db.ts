import { PrismaClient } from '@prisma/client'

/**
 * Prisma Client singleton — Vercel/serverless compatible.
 *
 * Why singleton? In serverless environments (Vercel), each invocation may
 * spin up a new instance. We cache PrismaClient on `globalThis` to avoid
 * creating new DB connections on every hot-reload during dev, and to
 * reuse connections across serverless invocations when possible.
 *
 * For production with PgBouncer (Neon, Vercel Postgres), set:
 *   ?pgbouncer=true&connect_timeout=15
 * in your DATABASE_URL.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
  })

// Cache on globalThis in all environments (not just dev) for serverless reuse
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db
}
