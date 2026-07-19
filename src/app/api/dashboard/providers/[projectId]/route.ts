/**
 * GET /api/dashboard/providers/[projectId]
 * POST /api/dashboard/providers/[projectId]
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok, badRequest, forbidden } from '@/lib/middleware/auth'
import { listProviderConfigs, upsertProviderConfig } from '@/lib/services/identity'
import { healthCheckAllProviders } from '@/lib/providers/registry'
import type { ProviderName } from '@/lib/types'

const VALID_PROVIDERS: ProviderName[] = ['fcm', 'email_smtp', 'webpush', 'inapp', 'onesignal', 'twilio']

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  const { projectId } = await params

  const [configs, health] = await Promise.all([
    listProviderConfigs(projectId),
    healthCheckAllProviders(projectId).catch(() => []),
  ])

  // Combine: for each valid provider, show config (or empty template) + health
  const result = VALID_PROVIDERS.map((name) => {
    const cfg = configs.find((c) => c.name === name)
    const h = health.find((p) => p.name === name)
    return {
      name,
      displayName: getProviderDisplayName(name),
      configured: !!cfg,
      enabled: cfg?.enabled ?? false,
      isDefault: cfg?.isDefault ?? false,
      credentials: cfg?.credentials || null,
      config: cfg?.config ? JSON.parse(cfg.config) : null,
      health: h || null,
    }
  })

  return ok(result)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  if (ctx.role === 'viewer') return forbidden('Insufficient permissions')

  const { projectId } = await params
  let body: {
    name?: ProviderName
    displayName?: string
    credentials?: Record<string, unknown>
    config?: Record<string, unknown>
    isDefault?: boolean
    enabled?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  if (!body.name || !VALID_PROVIDERS.includes(body.name)) {
    return badRequest(`Invalid provider name. Must be one of: ${VALID_PROVIDERS.join(', ')}`)
  }
  if (!body.credentials) return badRequest('credentials is required')

  const config = await upsertProviderConfig({
    projectId,
    name: body.name,
    displayName: body.displayName,
    credentials: body.credentials,
    config: body.config,
    isDefault: body.isDefault,
    enabled: body.enabled,
  })

  return ok({ id: config.id, name: config.name, configured: true })
}

function getProviderDisplayName(name: ProviderName): string {
  const map: Record<ProviderName, string> = {
    fcm: 'Firebase Cloud Messaging',
    email_smtp: 'Email (SMTP)',
    webpush: 'Web Push (VAPID)',
    inapp: 'In-App (Realtime)',
    onesignal: 'OneSignal',
    twilio: 'Twilio SMS',
  }
  return map[name]
}
