/**
 * POST /api/v1/webhooks/test
 * Test the project's webhook URL by sending a test event.
 * Useful for clients to verify their webhook endpoint is reachable.
 *
 * Body:
 *   { "event": "notification.sent" | "notification.delivered" | "notification.failed" }
 *   (default: "notification.sent")
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { sendWebhook } from '@/lib/services/webhook'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')

  let body: { event?: string } = {}
  try { body = await req.json() } catch { /* ignore */ }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const event = (body.event as 'notification.sent' | 'notification.delivered' | 'notification.failed') || 'notification.sent'

  const testEvent = {
    event,
    timestamp: new Date().toISOString(),
    data: {
      notificationId: `test_${randomUUID()}`,
      targetId: `test_target_${randomUUID()}`,
      projectId,
      channel: 'inapp',
      status: 'sent',
      endUserId: 'test-user',
      deviceId: null,
      providerMessageId: `test_msg_${Date.now()}`,
      error: null,
      attempts: 1,
    },
  }

  const result = await sendWebhook(projectId, testEvent)

  if (result.sent) {
    return ok({ sent: true, status: result.status, message: 'Webhook delivered successfully' })
  } else {
    return ok({ sent: false, status: result.status, error: result.error, message: 'Webhook delivery failed — check the URL and signature verification' })
  }
}
