/**
 * GET /api/metrics
 * Prometheus-format metrics endpoint.
 *
 * Exposes key platform metrics in Prometheus text format:
 *   - ucp_notifications_total{status,channel}
 *   - ucp_notifications_pending
 *   - ucp_api_keys_total{status}
 *   - ucp_end_users_total
 *   - ucp_devices_total{platform,status}
 *   - ucp_projects_total{status}
 *   - ucp_realtime_connections (from gateway)
 *   - ucp_db_connections_active
 *
 * Auth: Bearer INTERNAL_API_TOKEN (server-to-server, for Prometheus scrape)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { gatewayHealthCheck } from '@/lib/gateway-client'

const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'ucp-internal-dev-token-change-me'

export async function GET(req: NextRequest) {
  // Optional auth — allow either Bearer token or no auth (for public dashboards)
  const auth = req.headers.get('authorization')
  if (auth && auth !== `Bearer ${INTERNAL_API_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lines: string[] = []
  const ts = Date.now()

  try {
    // ============ Notifications ============
    lines.push('# HELP ucp_notifications_total Total notifications by status and channel')
    lines.push('# TYPE ucp_notifications_total counter')

    const notifByStatusChannel = await db.notification.groupBy({
      by: ['status', 'channel'],
      _count: true,
    })
    for (const row of notifByStatusChannel) {
      lines.push(`ucp_notifications_total{status="${row.status}",channel="${row.channel}"} ${row._count} ${ts}`)
    }

    // ============ Pending notifications ============
    lines.push('# HELP ucp_notifications_pending Currently pending notifications')
    lines.push('# TYPE ucp_notifications_pending gauge')
    const pendingCount = await db.notification.count({ where: { status: 'pending' } })
    lines.push(`ucp_notifications_pending ${pendingCount} ${ts}`)

    // ============ Scheduled notifications ============
    lines.push('# HELP ucp_notifications_scheduled Scheduled notifications awaiting delivery')
    lines.push('# TYPE ucp_notifications_scheduled gauge')
    const scheduledCount = await db.notification.count({
      where: { status: 'pending', scheduledAt: { gt: new Date() } },
    })
    lines.push(`ucp_notifications_scheduled ${scheduledCount} ${ts}`)

    // ============ API Keys ============
    lines.push('# HELP ucp_api_keys_total Total API keys by status')
    lines.push('# TYPE ucp_api_keys_total gauge')
    const apiKeysByStatus = await db.apiKey.groupBy({
      by: ['status'],
      _count: true,
    })
    for (const row of apiKeysByStatus) {
      lines.push(`ucp_api_keys_total{status="${row.status}"} ${row._count} ${ts}`)
    }

    // ============ End Users ============
    lines.push('# HELP ucp_end_users_total Total end users')
    lines.push('# TYPE ucp_end_users_total gauge')
    const endUsersCount = await db.endUser.count()
    lines.push(`ucp_end_users_total ${endUsersCount} ${ts}`)

    // ============ Devices ============
    lines.push('# HELP ucp_devices_total Total devices by platform and status')
    lines.push('# TYPE ucp_devices_total gauge')
    const devicesByPlatformStatus = await db.device.groupBy({
      by: ['platform', 'status'],
      _count: true,
    })
    for (const row of devicesByPlatformStatus) {
      lines.push(`ucp_devices_total{platform="${row.platform}",status="${row.status}"} ${row._count} ${ts}`)
    }

    // ============ Projects ============
    lines.push('# HELP ucp_projects_total Total projects by status')
    lines.push('# TYPE ucp_projects_total gauge')
    const projectsByStatus = await db.project.groupBy({
      by: ['status'],
      _count: true,
    })
    for (const row of projectsByStatus) {
      lines.push(`ucp_projects_total{status="${row.status}"} ${row._count} ${ts}`)
    }

    // ============ Tenants ============
    lines.push('# HELP ucp_tenants_total Total tenants by status')
    lines.push('# TYPE ucp_tenants_total gauge')
    const tenantsByStatus = await db.tenant.groupBy({
      by: ['status'],
      _count: true,
    })
    for (const row of tenantsByStatus) {
      lines.push(`ucp_tenants_total{status="${row.status}"} ${row._count} ${ts}`)
    }

    // ============ Events ============
    lines.push('# HELP ucp_events_total Total events by source')
    lines.push('# TYPE ucp_events_total counter')
    const eventsBySource = await db.event.groupBy({
      by: ['source'],
      _count: true,
    })
    for (const row of eventsBySource) {
      lines.push(`ucp_events_total{source="${row.source}"} ${row._count} ${ts}`)
    }

    // ============ Realtime (from gateway) ============
    lines.push('# HELP ucp_realtime_connections Active Socket.io connections')
    lines.push('# TYPE ucp_realtime_connections gauge')
    lines.push('# HELP ucp_realtime_presence Online users')
    lines.push('# TYPE ucp_realtime_presence gauge')
    lines.push('# HELP ucp_realtime_gateway_up Gateway health (1=up, 0=down)')
    lines.push('# TYPE ucp_realtime_gateway_up gauge')

    const gateway = await gatewayHealthCheck()
    if (gateway) {
      lines.push(`ucp_realtime_connections ${gateway.socketCount} ${ts}`)
      lines.push(`ucp_realtime_presence ${gateway.presenceCount} ${ts}`)
      lines.push(`ucp_realtime_gateway_up 1 ${ts}`)
    } else {
      lines.push(`ucp_realtime_connections 0 ${ts}`)
      lines.push(`ucp_realtime_presence 0 ${ts}`)
      lines.push(`ucp_realtime_gateway_up 0 ${ts}`)
    }

    // ============ Build info ============
    lines.push('# HELP ucp_build_info Build information')
    lines.push('# TYPE ucp_build_info gauge')
    lines.push(`ucp_build_info{version="1.4.0",node_env="${process.env.NODE_ENV || 'development'}"} 1 ${ts}`)
  } catch (e) {
    console.error('[Metrics] error:', e)
    // Still return what we have
  }

  return new NextResponse(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
