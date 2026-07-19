/**
 * POST /api/v1/devices
 * Register a device token (FCM, Web Push subscription, etc.)
 *
 * Body:
 *  {
 *    "externalUserId": "user-123",
 *    "token": "firebase-token-or-endpoint",
 *    "platform": "android" | "ios" | "web",
 *    "userAgent": "...",
 *    "appVersion": "1.0.0",
 *    "pushSubscription": { "endpoint": "...", "keys": {...} }  // for webpush
 *  }
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { registerDevice, registerEndUser } from '@/lib/services/identity'

const VALID_PLATFORMS = ['android', 'ios', 'web']

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'devices:register')
    if (scopeErr) return scopeErr
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const externalUserId = body.externalUserId as string
  const token = body.token as string
  const platform = body.platform as string

  if (!externalUserId) return badRequest('externalUserId is required')
  if (!token || typeof token !== 'string' || token.length < 10) return badRequest('token is required')
  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return badRequest(`platform must be one of: ${VALID_PLATFORMS.join(', ')}`)
  }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : (body.projectId as string)
  if (!projectId) return badRequest('projectId is required for dashboard users')

  // Ensure end-user exists (also creates if missing)
  await registerEndUser({
    projectId,
    externalId: externalUserId,
    name: body.userName as string | undefined,
    email: body.userEmail as string | undefined,
  })

  const device = await registerDevice({
    projectId,
    externalUserId,
    token,
    platform,
    userAgent: body.userAgent as string | undefined,
    appVersion: body.appVersion as string | undefined,
    pushSubscription: body.pushSubscription as { endpoint: string; keys: { p256dh: string; auth: string } } | undefined,
  })

  return ok({ deviceId: device.id, registered: true })
}

/**
 * GET /api/v1/devices
 * List devices for the project.
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'devices:read')
    if (scopeErr) return scopeErr
  }
  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10)
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)

  const { listDevices } = await import('@/lib/services/identity')
  const result = await listDevices(projectId, page, pageSize)
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages })
}
