/**
 * GET /api/dashboard/events/[projectId]
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok } from '@/lib/middleware/auth'
import { listEvents } from '@/lib/services/eventbus'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  const { projectId } = await params

  const type = req.nextUrl.searchParams.get('type') || undefined
  const source = req.nextUrl.searchParams.get('source') || undefined
  const channel = req.nextUrl.searchParams.get('channel') || undefined
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10)
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '50', 10)

  const result = await listEvents(projectId, { type, source, channel, page, pageSize })
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages })
}
