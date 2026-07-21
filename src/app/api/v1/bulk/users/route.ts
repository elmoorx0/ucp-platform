/**
 * POST /api/v1/bulk/users
 * Bulk register/update end users (up to 1000 per request).
 *
 * Body:
 *   {
 *     "users": [
 *       { "externalId": "u1", "email": "u1@x.com", "name": "User 1", "tags": ["vip"] },
 *       { "externalId": "u2", "email": "u2@x.com", "name": "User 2" },
 *       ...
 *     ]
 *   }
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { bulkRegisterUsers } from '@/lib/services/bulk'

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'users:write')
    if (scopeErr) return scopeErr
  }

  let body: { users?: unknown[]; projectId?: string }
  try { body = await req.json() } catch { return badRequest('Invalid JSON body') }

  if (!body.users || !Array.isArray(body.users)) {
    return badRequest('users array is required')
  }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : body.projectId
  if (!projectId) return badRequest('projectId is required')

  try {
    const result = await bulkRegisterUsers(projectId, { users: body.users as never })
    return ok(result)
  } catch (e) {
    return badRequest((e as Error).message, 'BULK_FAILED')
  }
}
