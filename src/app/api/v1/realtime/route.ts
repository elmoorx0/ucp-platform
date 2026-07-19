/**
 * POST /api/v1/realtime/broadcast
 * Server-side broadcast to a channel (e.g. for chat apps, live dashboards).
 *
 * Body:
 *  {
 *    "channel": "orders",
 *    "event": "order.created",
 *    "payload": {...},
 *    "targetUserId": "u123"  // optional, for direct messages
 *  }
 *
 * Note: For client-to-client messages, the Socket.io client can emit 'message' directly.
 * This endpoint is for server-initiated broadcasts.
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
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

  const channel = body.channel as string
  const event = body.event as string
  const payload = body.payload
  const targetUserId = body.targetUserId as string | undefined

  if (!event || typeof event !== 'string') return badRequest('event is required')
  if (channel && (typeof channel !== 'string' || channel.length > 200)) {
    return badRequest('Invalid channel name')
  }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : (body.projectId as string)
  if (!projectId) return badRequest('projectId is required for dashboard users')

  // Emit event — gateway poller will pick this up via DB? No, the gateway uses Socket.io only.
  // For server-initiated broadcasts, we'd need a way to push to the gateway.
  // For now, we persist as an event and return. The client SDKs can also subscribe via REST polling.
  const eventId = await publishEvent(
    projectId,
    `realtime.${event}`,
    'external',
    { channel, event, payload, targetUserId, fromApiKey: 'apiKeyId' in ctx ? ctx.apiKeyId : undefined },
    { channel: targetUserId ? `user:${targetUserId}` : channel ? `channel:${channel}` : undefined }
  )

  return ok({ eventId, channel, event, persisted: true, note: 'For low-latency delivery, use the Socket.io gateway directly.' })
}
