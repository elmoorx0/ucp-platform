/**
 * API Key management for dashboard.
 * GET  /api/dashboard/api-keys?projectId=...
 * POST /api/dashboard/api-keys  { projectId, name, scopes, ... }
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok, badRequest, forbidden } from '@/lib/middleware/auth'
import { createApiKey, listApiKeys } from '@/lib/services/identity'

export async function GET(req: NextRequest) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')
  const keys = await listApiKeys(projectId)
  return ok(keys)
}

export async function POST(req: NextRequest) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')

  let body: {
    projectId?: string
    name?: string
    scopes?: string[]
    permissions?: string[]
    rateLimitPerMin?: number
    expiresAt?: string
    test?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  if (!body.projectId || !body.name) {
    return badRequest('projectId and name are required')
  }

  // Check role
  if (ctx.role === 'viewer') {
    return forbidden('Insufficient permissions')
  }

  const created = await createApiKey({
    projectId: body.projectId,
    name: body.name,
    scopes: body.scopes,
    permissions: body.permissions,
    rateLimitPerMin: body.rateLimitPerMin,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    test: body.test,
  })

  return ok(created)
}
