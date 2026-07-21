/**
 * POST /api/v1/bulk/notifications
 * Bulk send notifications (up to 100 per request).
 * Each item creates a separate notification.
 *
 * Body:
 *   {
 *     "notifications": [
 *       { "channel": "inapp", "to": ["user-001"], "title": "Hi 1", "body": "..." },
 *       { "channel": "email", "to": ["user-002"], "title": "Hi 2", "body": "..." },
 *       ...
 *     ]
 *   }
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { bulkSendNotifications } from '@/lib/services/bulk'

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'notifications:send')
    if (scopeErr) return scopeErr
  }

  let body: { notifications?: unknown[]; projectId?: string }
  try { body = await req.json() } catch { return badRequest('Invalid JSON body') }

  if (!body.notifications || !Array.isArray(body.notifications)) {
    return badRequest('notifications array is required')
  }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : body.projectId
  if (!projectId) return badRequest('projectId is required')

  try {
    const result = await bulkSendNotifications(
      projectId,
      body.notifications as never,
      {
        apiKeyId: 'apiKeyId' in ctx ? ctx.apiKeyId : undefined,
        userId: 'userId' in ctx ? ctx.userId : undefined,
        tenantId: 'tenantId' in ctx ? ctx.tenantId : undefined,
        ip: req.headers.get('x-forwarded-for') || undefined,
      }
    )
    return ok(result)
  } catch (e) {
    return badRequest((e as Error).message, 'BULK_SEND_FAILED')
  }
}
