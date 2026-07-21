/**
 * POST /api/v1/users/unsubscribe
 * Unsubscribe a user from a topic.
 *
 * Body:
 *   { "externalUserId": "user-001", "topic": "marketing" }
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { unsubscribeFromTopic } from '@/lib/services/topics'

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'users:write')
    if (scopeErr) return scopeErr
  }

  let body: { externalUserId?: string; topic?: string; projectId?: string }
  try { body = await req.json() } catch { return badRequest('Invalid JSON body') }

  if (!body.externalUserId) return badRequest('externalUserId is required')
  if (!body.topic) return badRequest('topic is required')

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : body.projectId
  if (!projectId) return badRequest('projectId is required')

  const result = await unsubscribeFromTopic(projectId, body.externalUserId, body.topic)
  return ok(result)
}
