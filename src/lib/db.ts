import { PrismaClient } from '@prisma/client'

/**
 * Prisma Client singleton — Vercel/serverless compatible.
 *
 * Database strategy:
 *  - Local dev: SQLite file (DATABASE_URL="file:./db/custom.db")
 *  - Production (Vercel): Turso libSQL (DATABASE_URL="libsql://...")
 *
 * IMPORTANT: On Vercel serverless, SQLite file URLs (file:./...) will NOT work
 * because the filesystem is read-only. You MUST use Turso:
 *   1. Create a free Turso account: https://turso.tech
 *   2. Create a database: turso db create ucp
 *   3. Set DATABASE_URL="libsql://ucp-xxx.turso.io?authToken=xxx" in Vercel
 *
 * Why singleton? In serverless environments (Vercel), each invocation may
 * spin up a new instance. We cache PrismaClient on `globalThis` to avoid
 * creating new DB connections on every hot-reload during dev, and to
 * reuse connections across serverless invocations when possible.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    const msg = [
      '[UCP] FATAL: DATABASE_URL environment variable is not set!',
      '',
      'For local development:',
      '  1. Copy .env.example to .env',
      '  2. Set DATABASE_URL="file:./db/custom.db"',
      '  3. Run: bun run db:push',
      '',
      'For Vercel production (REQUIRED):',
      '  SQLite file URLs do NOT work on Vercel (read-only filesystem).',
      '  You MUST use Turso (free SQLite in the cloud):',
      '  1. Sign up at https://turso.tech (free)',
      '  2. Create database: turso db create ucp',
      '  3. Get URL: turso db show ucp --url',
      '  4. Get token: turso db tokens create ucp',
      '  5. In Vercel dashboard → Settings → Environment Variables:',
      '     DATABASE_URL = libsql://ucp-xxx.turso.io?authToken=xxx',
      '  6. Redeploy',
    ].join('\n')
    console.error(msg)
    throw new Error('DATABASE_URL is not set. Check server logs for setup instructions.')
  }

  // If DATABASE_URL starts with "libsql://", use Turbo adapter (production)
  if (databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('libsql:')) {
    return createTursoClient(databaseUrl)
  }

  // Local SQLite file (development only — does NOT work on Vercel)
  if (databaseUrl.startsWith('file:')) {
    // Warn if running on Vercel with file: URL
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      console.error([
        '[UCP] WARNING: DATABASE_URL starts with "file:" but you appear to be',
        'running on Vercel/production. SQLite files do NOT work on Vercel',
        'because the filesystem is read-only.',
        '',
        'Please switch to Turso (free SQLite in the cloud):',
        '  1. https://turso.tech — sign up',
        '  2. turso db create ucp',
        '  3. turso db show ucp --url',
        '  4. turso db tokens create ucp',
        '  5. Set DATABASE_URL="libsql://ucp-xxx.turso.io?authToken=xxx"',
        '     in Vercel → Settings → Environment Variables',
        '  6. Redeploy',
      ].join('\n'))
    }
    return new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn'],
    })
  }

  // Unknown URL format
  console.error(`[UCP] Unknown DATABASE_URL format: ${databaseUrl.substring(0, 30)}...`)
  console.error('Expected formats: "file:./db/custom.db" or "libsql://xxx.turso.io?authToken=xxx"')
  throw new Error(`Invalid DATABASE_URL format`)
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
