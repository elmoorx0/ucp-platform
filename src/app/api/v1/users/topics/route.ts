/**
 * GET /api/v1/users/topics
 * List topics a user is subscribed to.
 *
 * Query: externalUserId (required)
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { getUserTopics } from '@/lib/services/topics'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'users:read')
    if (scopeErr) return scopeErr
  }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  const externalUserId = req.nextUrl.searchParams.get('externalUserId')
  if (!projectId) return badRequest('projectId is required')
  if (!externalUserId) return badRequest('externalUserId is required')

  const topics = await getUserTopics(projectId, externalUserId)
  return ok({ topics })
}
