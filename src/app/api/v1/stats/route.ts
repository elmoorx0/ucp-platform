/**
 * GET /api/v1/stats
 * Returns notification stats for the project.
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { getNotificationStats } from '@/lib/services/notification'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'stats:read')
    if (scopeErr) return scopeErr
  }
  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10)
  const stats = await getNotificationStats(projectId, days)
  return ok(stats)
}
