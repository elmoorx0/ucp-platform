/**
 * POST /api/dashboard/api-keys/[id]/revoke
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok, badRequest, forbidden } from '@/lib/middleware/auth'
import { revokeApiKey } from '@/lib/services/identity'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  if (ctx.role === 'viewer') return forbidden('Insufficient permissions')

  const { id } = await params
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  await revokeApiKey(projectId, id)
  return ok({ revoked: true, id })
}
