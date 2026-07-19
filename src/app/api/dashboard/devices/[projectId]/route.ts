/**
 * GET /api/dashboard/devices/[projectId]
 * GET /api/dashboard/endusers/[projectId]
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok } from '@/lib/middleware/auth'
import { listDevices, listEndUsers } from '@/lib/services/identity'

export async function GET_devices(
  req: NextRequest,
  projectId: string
) {
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10)
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)
  const result = await listDevices(projectId, page, pageSize)
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages })
}

export async function GET_endusers(
  req: NextRequest,
  projectId: string
) {
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10)
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)
  const result = await listEndUsers(projectId, page, pageSize)
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  return GET_devices(req, (await params).projectId)
}

export { GET_devices, GET_endusers }
