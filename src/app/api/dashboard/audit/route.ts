/**
 * GET /api/dashboard/audit
 * List audit logs.
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok } from '@/lib/middleware/auth'
import { listAuditLogs } from '@/lib/services/identity'

export async function GET(req: NextRequest) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')

  const action = req.nextUrl.searchParams.get('action') || undefined
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10)
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '50', 10)

  const result = await listAuditLogs(
    { tenantId: ctx.tenantId, userId: ctx.userId, action },
    page,
    pageSize
  )
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages })
}
