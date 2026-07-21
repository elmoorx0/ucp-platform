/**
 * GET /api/dashboard/audit/export
 * Export audit logs as CSV file.
 *
 * Query params:
 *   - format: csv (default)
 *   - from: ISO date string (optional)
 *   - to: ISO date string (optional)
 *   - action: filter by action (optional)
 *   - limit: max rows (default 1000, max 10000)
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateDashboard, unauthorized, badRequest } from '@/lib/middleware/auth'
import { db } from '@/lib/db'

function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')

  const url = new URL(req.url)
  const fromStr = url.searchParams.get('from')
  const toStr = url.searchParams.get('to')
  const actionFilter = url.searchParams.get('action')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000', 10), 10000)

  // Build where clause
  const where: Record<string, unknown> = {}
  if (ctx.tenantId) where.tenantId = ctx.tenantId
  if (actionFilter) where.action = { contains: actionFilter }

  const dateRange: Record<string, unknown> = {}
  if (fromStr) dateRange.gte = new Date(fromStr)
  if (toStr) dateRange.lte = new Date(toStr)
  if (Object.keys(dateRange).length > 0) where.createdAt = dateRange

  // Fetch logs
  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { email: true, name: true } },
    },
  })

  // Build CSV
  const headers = [
    'ID',
    'Timestamp',
    'Action',
    'Status',
    'Resource',
    'Resource ID',
    'User Email',
    'User Name',
    'API Key ID',
    'IP Address',
    'User Agent',
    'Message',
    'Before',
    'After',
  ]

  const rows = logs.map((log) => [
    log.id,
    log.createdAt.toISOString(),
    log.action,
    log.status,
    log.resource || '',
    log.resourceId || '',
    log.user?.email || '',
    log.user?.name || '',
    log.apiKeyId || '',
    log.ip || '',
    log.userAgent || '',
    log.message || '',
    log.before || '',
    log.after || '',
  ])

  const csv = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n')

  const filename = `ucp-audit-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
