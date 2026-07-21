/**
 * GET /api/v1/topics
 * List all topics with subscriber counts.
 *
 * Query:
 *   - topic (optional) — get details for a specific topic
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { listProjectTopics, getTopicSubscriberCount } from '@/lib/services/topics'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'users:read')
    if (scopeErr) return scopeErr
  }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const specificTopic = req.nextUrl.searchParams.get('topic')
  if (specificTopic) {
    const count = await getTopicSubscriberCount(projectId, specificTopic)
    return ok({ topic: specificTopic, subscriberCount: count })
  }

  const topics = await listProjectTopics(projectId)
  return ok(topics)
}
