/**
 * GET /api/v1/events
 * List events from the event bus (audit log of platform events).
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { listEvents } from '@/lib/services/eventbus'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'events:read')
    if (scopeErr) return scopeErr
  }
  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const type = req.nextUrl.searchParams.get('type') || undefined
  const source = req.nextUrl.searchParams.get('source') || undefined
  const channel = req.nextUrl.searchParams.get('channel') || undefined
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10)
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '50', 10)

  const result = await listEvents(projectId, { type, source, channel, page, pageSize })
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages })
}
