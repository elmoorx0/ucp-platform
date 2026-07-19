/**
 * GET /api/v1/channels
 * List active realtime channels.
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'channels:read')
    if (scopeErr) return scopeErr
  }
  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const channels = await db.realtimeChannel.findMany({
    where: { projectId },
    orderBy: { lastActivityAt: 'desc' },
    take: 100,
  })
  return ok(channels)
}
