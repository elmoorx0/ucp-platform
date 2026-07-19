/**
 * GET /api/v1/presence
 * Returns online users for the project.
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { getOnlineUsers, getUserPresence, getPresenceStats } from '@/lib/services/presence'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'presence:read')
    if (scopeErr) return scopeErr
  }
  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const userId = req.nextUrl.searchParams.get('userId')
  if (userId) {
    const state = await getUserPresence(projectId, userId)
    return ok(state)
  }

  const [users, stats] = await Promise.all([
    getOnlineUsers(projectId),
    getPresenceStats(projectId),
  ])
  return ok({ users, stats })
}
