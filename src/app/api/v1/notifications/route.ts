/**
 * POST /api/v1/notifications
 * Send a notification via UCP.
 *
 * Body:
 *  {
 *    "channel": "push" | "email" | "inapp" | "webpush" | "multi",
 *    "title": "...",
 *    "body": "...",
 *    "imageUrl": "...",
 *    "data": {...},
 *    "targetingType": "user" | "topic" | "broadcast",
 *    "targetingData": { "externalUserIds": ["u1", "u2"], "userIds": [...], "topic": "..." },
 *    "providerName": "fcm" | "email_smtp" | ...,
 *    "priority": "low" | "normal" | "high",
 *    "scheduledAt": "2026-01-01T00:00:00Z",
 *    "externalId": "idempotency-key"
 *  }
 *
 * Also supports a simpler "to" field:
 *  { "channel": "inapp", "to": ["user1", "user2"], "title": "...", "body": "..." }
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { sendNotification } from '@/lib/services/notification'
import type { ChannelType, NotificationInput, TargetingType } from '@/lib/types'

const VALID_CHANNELS = ['push', 'email', 'inapp', 'webpush', 'sms', 'multi']
const VALID_TARGETING = ['user', 'topic', 'segment', 'broadcast']

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'notifications:send')
    if (scopeErr) return scopeErr
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const channel = body.channel as string
  const title = body.title as string
  const body_text = body.body as string
  const to = body.to as string | string[] | undefined

  if (!channel || !VALID_CHANNELS.includes(channel)) {
    return badRequest(`Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}`)
  }
  if (!title || typeof title !== 'string' || title.length === 0) {
    return badRequest('title is required')
  }
  if (!body_text || typeof body_text !== 'string') {
    return badRequest('body is required')
  }

  // Build targeting data
  let targetingType: TargetingType = (body.targetingType as TargetingType) || 'user'
  let targetingData: NotificationInput['targetingData'] = body.targetingData as NotificationInput['targetingData']

  // Convenience: "to" field auto-builds targeting
  if (to && !targetingData) {
    const arr = Array.isArray(to) ? to : [to]
    targetingData = { externalUserIds: arr.filter((x): x is string => typeof x === 'string') }
  }

  if (targetingType && !VALID_TARGETING.includes(targetingType)) {
    return badRequest(`Invalid targetingType. Must be one of: ${VALID_TARGETING.join(', ')}`)
  }

  if (targetingType === 'broadcast' && to) {
    return badRequest('Cannot use "to" with broadcast targeting')
  }

  const input: NotificationInput = {
    channel: channel as ChannelType | 'multi',
    title,
    body: body_text,
    imageUrl: body.imageUrl as string | undefined,
    data: body.data as Record<string, unknown> | undefined,
    targetingType,
    targetingData,
    providerName: body.providerName as NotificationInput['providerName'],
    priority: body.priority as 'low' | 'normal' | 'high',
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt as string) : undefined,
    externalId: body.externalId as string | undefined,
  }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : (body.projectId as string)
  if (!projectId) return badRequest('projectId is required for dashboard users')

  try {
    const result = await sendNotification(projectId, input, {
      apiKeyId: 'apiKeyId' in ctx ? ctx.apiKeyId : undefined,
      userId: 'userId' in ctx ? ctx.userId : undefined,
      tenantId: 'tenantId' in ctx ? ctx.tenantId : undefined,
      ip: req.headers.get('x-forwarded-for') || undefined,
    })
    return ok(result, { requestId: result.id })
  } catch (e) {
    return badRequest((e as Error).message, 'SEND_FAILED')
  }
}

/**
 * GET /api/v1/notifications
 * List notifications for the authenticated project.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'notifications:read')
    if (scopeErr) return scopeErr
  }
  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const url = new URL(req.url)
  const status = url.searchParams.get('status') || undefined
  const channel = url.searchParams.get('channel') || undefined
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10)

  const { listNotifications } = await import('@/lib/services/notification')
  const result = await listNotifications(projectId, { status, channel, page, pageSize })
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages })
}
