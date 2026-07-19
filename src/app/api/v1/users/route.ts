/**
 * POST /api/v1/users
 * Register / update an end-user (notification recipient).
 *
 * Body:
 *  {
 *    "externalId": "user-123",
 *    "email": "...", "phone": "...", "name": "...",
 *    "language": "en", "timezone": "UTC",
 *    "tags": ["vip", "beta"], "attributes": {...}
 *  }
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { registerEndUser, listEndUsers } from '@/lib/services/identity'

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'users:write')
    if (scopeErr) return scopeErr
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const externalId = body.externalId as string
  if (!externalId) return badRequest('externalId is required')

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : (body.projectId as string)
  if (!projectId) return badRequest('projectId is required for dashboard users')

  const user = await registerEndUser({
    projectId,
    externalId,
    email: body.email as string | undefined,
    phone: body.phone as string | undefined,
    name: body.name as string | undefined,
    language: body.language as string | undefined,
    timezone: body.timezone as string | undefined,
    tags: body.tags as string[] | undefined,
    attributes: body.attributes as Record<string, unknown> | undefined,
  })

  return ok({ userId: user.id, externalId: user.externalId, registered: true })
}

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'users:read')
    if (scopeErr) return scopeErr
  }
  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10)
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)

  const result = await listEndUsers(projectId, page, pageSize)
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages })
}
