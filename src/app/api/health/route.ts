/**
 * GET /api/health
 * System health check.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gatewayHealthCheck } from '@/lib/gateway-client'

export async function GET() {
  const checks: Record<string, unknown> = {}

  // DB check
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { ok: true }
  } catch (e) {
    checks.database = { ok: false, error: (e as Error).message }
  }

  // Gateway check (optional — may be down in some sandbox environments)
  const gateway = await gatewayHealthCheck()
  if (gateway) {
    checks.gateway = { ...gateway, ok: true }
  } else {
    checks.gateway = { ok: false, note: 'Gateway not reachable — restart with: cd mini-services/realtime-gateway && bun index.ts' }
  }

  // Counts
  try {
    const [projects, users, apiKeys, notifications] = await Promise.all([
      db.project.count(),
      db.user.count(),
      db.apiKey.count(),
      db.notification.count(),
    ])
    checks.counts = { projects, users, apiKeys, notifications }
  } catch {
    // ignore
  }

  // Overall health — DB is required, gateway is optional
  const dbOk = (checks.database as { ok: boolean }).ok
  const gatewayOk = (checks.gateway as { ok: boolean }).ok
  const status = dbOk ? (gatewayOk ? 'healthy' : 'degraded') : 'unhealthy'
  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks,
  })
}
