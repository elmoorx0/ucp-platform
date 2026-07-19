/**
 * GET /api/dashboard/stats/[projectId]
 * Returns aggregated stats for the dashboard.
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok } from '@/lib/middleware/auth'
import { getNotificationStats } from '@/lib/services/notification'
import { getPresenceStats } from '@/lib/services/presence'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  const { projectId } = await params
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10)

  const [notifStats, presenceStats, counts] = await Promise.all([
    getNotificationStats(projectId, days),
    getPresenceStats(projectId),
    db.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            apiKeys: true,
            endUsers: true,
            devices: true,
            notifications: true,
            providers: true,
          },
        },
      },
    }),
  ])

  return ok({
    notifStats,
    presenceStats,
    counts: counts?._count || {},
    project: counts ? { id: counts.id, name: counts.name, status: counts.status } : null,
  })
}
