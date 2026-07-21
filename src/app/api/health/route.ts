/**
 * GET /api/health
 * System health check with configuration status.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gatewayHealthCheck, isGatewayConfigured } from '@/lib/gateway-client'
import { ensureDbInitialized } from '@/lib/db'

export async function GET() {
  const checks: Record<string, unknown> = {}

  // Ensure DB is initialized (creates tables if using /tmp fallback)
  await ensureDbInitialized().catch(() => {})

  // DB check
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { ok: true, url: process.env.DATABASE_URL?.substring(0, 30) + '...' }
  } catch (e) {
    checks.database = { ok: false, error: (e as Error).message }
  }

  // Gateway check (optional)
  const gatewayConfigured = isGatewayConfigured()
  if (gatewayConfigured) {
    const gateway = await gatewayHealthCheck()
    checks.gateway = gateway
      ? { ...gateway, ok: true, configured: true }
      : { ok: false, configured: true, error: 'Gateway configured but unreachable' }
  } else {
    checks.gateway = { ok: false, configured: false, note: 'Set REALTIME_GATEWAY_URL to enable realtime features' }
  }

  // Config status
  checks.config = {
    database: !!process.env.DATABASE_URL,
    jwtSecret: !!process.env.JWT_SECRET,
    apiKeyHashSecret: !!process.env.API_KEY_HASH_SECRET,
    internalApiToken: !!process.env.INTERNAL_API_TOKEN,
    gatewayUrl: gatewayConfigured,
  }

  // Counts
  try {
    const [projects, users, apiKeys, notifications] = await Promise.all([
      db.project.count().catch(() => 0),
      db.user.count().catch(() => 0),
      db.apiKey.count().catch(() => 0),
      db.notification.count().catch(() => 0),
    ])
    checks.counts = { projects, users, apiKeys, notifications }
  } catch {
    checks.counts = { projects: 0, users: 0, apiKeys: 0, notifications: 0 }
  }

  // Overall health
  const dbOk = (checks.database as { ok: boolean }).ok
  const status = dbOk ? 'healthy' : 'unhealthy'

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks,
  })
}
