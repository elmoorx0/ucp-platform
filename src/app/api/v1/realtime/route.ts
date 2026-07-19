/**
 * POST /api/v1/realtime/broadcast
 * Server-side broadcast via the Realtime Gateway (instant push, no polling).
 *
 * Body:
 *  {
 *    "channel": "orders",         // optional
 *    "event": "order.created",
 *    "payload": {...},
 *    "targetUserId": "u123",      // optional, for direct messages
 *    "target": "user" | "channel" | "project" | "all"  // default derived
 *  }
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { pushToGateway, PushTarget } from '@/lib/gateway-client'
import { publishEvent } from '@/lib/services/eventbus'

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'realtime:broadcast')
    if (scopeErr) return scopeErr
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const channel = body.channel as string | undefined
  const event = body.event as string
  const payload = body.payload
  const targetUserId = body.targetUserId as string | undefined
  const explicitTarget = body.target as PushTarget | undefined

  if (!event || typeof event !== 'string') return badRequest('event is required')
  if (channel && (typeof channel !== 'string' || channel.length > 200)) {
    return badRequest('Invalid channel name')
  }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : (body.projectId as string)
  if (!projectId) return badRequest('projectId is required for dashboard users')

  // Determine target
  const target: PushTarget = explicitTarget || (targetUserId ? 'user' : channel ? 'channel' : 'project')

  // Push directly to gateway (instant)
  const pushResult = await pushToGateway({
    target,
    projectId,
    channel,
    userId: targetUserId,
    event,
    payload,
  })

  // Persist as event for audit/replay
  const eventId = await publishEvent(
    projectId,
    `realtime.${event}`,
    'external',
    { channel, event, payload, targetUserId, fromApiKey: 'apiKeyId' in ctx ? ctx.apiKeyId : undefined },
    { channel: targetUserId ? `user:${targetUserId}` : channel ? `channel:${channel}` : undefined }
  )

  return ok({
    eventId,
    channel,
    event,
    delivered: pushResult?.recipients || 0,
    gatewayOk: !!pushResult,
  })
}
