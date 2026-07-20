/**
 * GET /api/v1/notifications/scheduled
 * List upcoming scheduled notifications for the project.
 *
 * Query params:
 *   - hoursAhead: number (default 24) — how far ahead to look
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { getUpcomingScheduled } from '@/lib/services/scheduler'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'notifications:read')
    if (scopeErr) return scopeErr
  }
  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const hoursAhead = parseInt(req.nextUrl.searchParams.get('hoursAhead') || '24', 10)
  const clamped = Math.min(Math.max(hoursAhead, 1), 168) // max 7 days

  const upcoming = await getUpcomingScheduled(projectId, clamped)
  return ok(upcoming)
}
