/**
 * Dashboard: list notifications, get one, cancel.
 * GET /api/dashboard/notifications?projectId=...&status=...&page=...
 * POST /api/dashboard/notifications — create & send (uses same logic as API)
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok, badRequest } from '@/lib/middleware/auth'
import { listNotifications, getNotification, sendNotification, cancelNotification } from '@/lib/services/notification'

export async function GET(req: NextRequest) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const status = req.nextUrl.searchParams.get('status') || undefined
  const channel = req.nextUrl.searchParams.get('channel') || undefined
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10)
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)

  const result = await listNotifications(projectId, { status, channel, page, pageSize })
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages })
}

export async function POST(req: NextRequest) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const projectId = body.projectId as string
  if (!projectId) return badRequest('projectId is required')

  const result = await sendNotification(projectId, {
    channel: body.channel as 'push' | 'email' | 'inapp' | 'webpush' | 'multi',
    title: body.title as string,
    body: body.body as string,
    imageUrl: body.imageUrl as string | undefined,
    data: body.data as Record<string, unknown> | undefined,
    targetingType: body.targetingType as 'user' | 'topic' | 'broadcast' | undefined,
    targetingData: body.targetingData as { externalUserIds?: string[]; userIds?: string[]; topic?: string } | undefined,
    providerName: body.providerName as never,
    priority: body.priority as 'low' | 'normal' | 'high' | undefined,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt as string) : undefined,
    externalId: body.externalId as string | undefined,
  }, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    ip: req.headers.get('x-forwarded-for') || undefined,
  })

  return ok(result)
}
