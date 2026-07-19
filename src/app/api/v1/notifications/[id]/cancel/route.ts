/**
 * POST /api/v1/notifications/:id/cancel
 * Cancel a pending/scheduled notification.
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { cancelNotification } from '@/lib/services/notification'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'notifications:cancel')
    if (scopeErr) return scopeErr
  }
  const { id } = await params
  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  try {
    const result = await cancelNotification(projectId, id)
    return ok(result)
  } catch (e) {
    return badRequest((e as Error).message, 'CANCEL_FAILED')
  }
}
