/**
 * GET /api/dashboard/devices/[projectId]
 * List devices for a project (dashboard only).
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok } from '@/lib/middleware/auth'
import { listDevices } from '@/lib/services/identity'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  const { projectId } = await params
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10)
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)
  const result = await listDevices(projectId, page, pageSize)
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages })
}
