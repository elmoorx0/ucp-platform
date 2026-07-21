/**
 * GET /api/v1/users/preferences
 * Get notification preferences for a user.
 *
 * POST /api/v1/users/preferences
 * Update notification preferences for a user.
 *
 * Query/body params:
 *   - externalUserId (required)
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { getUserPreferences, updateUserPreferences } from '@/lib/services/preferences'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'users:read')
    if (scopeErr) return scopeErr
  }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  const externalUserId = req.nextUrl.searchParams.get('externalUserId')
  if (!projectId) return badRequest('projectId is required')
  if (!externalUserId) return badRequest('externalUserId is required')

  // Find the end user by external ID
  const { db } = await import('@/lib/db')
  const endUser = await db.endUser.findFirst({
    where: { projectId, externalId: externalUserId },
    select: { id: true },
  })
  if (!endUser) return badRequest('End user not found')

  const prefs = await getUserPreferences(projectId, endUser.id)
  return ok(prefs)
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'users:write')
    if (scopeErr) return scopeErr
  }

  let body: { externalUserId?: string; preferences?: Record<string, unknown> }
  try { body = await req.json() } catch { return badRequest('Invalid JSON body') }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : (body as { projectId?: string }).projectId
  if (!projectId) return badRequest('projectId is required')
  if (!body.externalUserId) return badRequest('externalUserId is required')

  const { db } = await import('@/lib/db')
  const endUser = await db.endUser.findFirst({
    where: { projectId, externalId: body.externalUserId },
    select: { id: true },
  })
  if (!endUser) return badRequest('End user not found')

  const updated = await updateUserPreferences(projectId, endUser.id, body.preferences as never)
  return ok(updated)
}
