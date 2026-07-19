/**
 * GET /api/v1/notifications/:id
 * Get a single notification with its targets/delivery status.
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, notFound, requireScope } from '@/lib/middleware/auth'
import { getNotification } from '@/lib/services/notification'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'notifications:read')
    if (scopeErr) return scopeErr
  }
  const { id } = await params
  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const result = await getNotification(projectId, id)
  if (!result) return notFound('Notification not found')
  return ok(result)
}
