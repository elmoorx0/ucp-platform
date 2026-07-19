/**
 * GET /api/v1/providers
 * List configured providers for the project.
 * POST /api/v1/providers
 * Create / update provider configuration.
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { listProviderConfigs, upsertProviderConfig } from '@/lib/services/identity'
import type { ProviderName } from '@/lib/types'

const VALID_PROVIDERS: ProviderName[] = ['fcm', 'email_smtp', 'webpush', 'inapp', 'onesignal', 'twilio']

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'providers:read')
    if (scopeErr) return scopeErr
  }
  const projectId = 'apiKeyId' in ctx ? ctx.projectId : req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')

  const configs = await listProviderConfigs(projectId)
  return ok(configs)
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'providers:write')
    if (scopeErr) return scopeErr
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const name = body.name as ProviderName
  if (!name || !VALID_PROVIDERS.includes(name)) {
    return badRequest(`Invalid provider name. Must be one of: ${VALID_PROVIDERS.join(', ')}`)
  }

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : (body.projectId as string)
  if (!projectId) return badRequest('projectId is required')

  const config = await upsertProviderConfig({
    projectId,
    name,
    displayName: body.displayName as string | undefined,
    credentials: body.credentials as Record<string, unknown>,
    config: body.config as Record<string, unknown> | undefined,
    isDefault: body.isDefault as boolean | undefined,
    enabled: body.enabled as boolean | undefined,
  })

  return ok({ id: config.id, name: config.name, configured: true })
}
