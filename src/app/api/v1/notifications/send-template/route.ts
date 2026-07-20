/**
 * POST /api/v1/notifications/send-template
 * Send a notification using a pre-defined template.
 *
 * Body:
 *   {
 *     "template": "welcome" | "otp" | "order_shipped" | ...,
 *     "variables": { "name": "Alice", "appName": "MyApp" },
 *     "locale": "en" | "ar" | "fr" | ...,
 *     "to": ["user-001", "user-002"],
 *     "channel": "inapp" | "push" | "email" | "multi",
 *     "priority": "normal" | "high" | "low"
 *   }
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest, requireScope } from '@/lib/middleware/auth'
import { sendNotification } from '@/lib/services/notification'
import { renderTemplateSafe } from '@/lib/services/templates'
import type { ChannelType } from '@/lib/types'

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')
  if ('apiKeyId' in ctx) {
    const scopeErr = requireScope(ctx, 'notifications:send')
    if (scopeErr) return scopeErr
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const templateKey = body.template as string
  const variables = (body.variables as Record<string, string | number | boolean>) || {}
  const locale = (body.locale as string) || 'en'
  const to = body.to as string[] | undefined
  const channel = (body.channel as ChannelType | 'multi') || 'inapp'
  const priority = body.priority as 'low' | 'normal' | 'high' | undefined

  if (!templateKey) return badRequest('template is required')
  if (!to || !Array.isArray(to) || to.length === 0) return badRequest('to (array of user IDs) is required')

  // Render template
  const rendered = await renderTemplateSafe(templateKey, variables, locale, 'apiKeyId' in ctx ? ctx.projectId : undefined)

  const projectId = 'apiKeyId' in ctx ? ctx.projectId : (body.projectId as string)
  if (!projectId) return badRequest('projectId is required for dashboard users')

  const result = await sendNotification(projectId, {
    channel,
    title: rendered.title,
    body: rendered.body,
    imageUrl: rendered.imageUrl,
    data: rendered.data,
    targetingType: 'user',
    targetingData: { externalUserIds: to },
    priority,
  }, {
    apiKeyId: 'apiKeyId' in ctx ? ctx.apiKeyId : undefined,
    userId: 'userId' in ctx ? ctx.userId : undefined,
    tenantId: 'tenantId' in ctx ? ctx.tenantId : undefined,
    ip: req.headers.get('x-forwarded-for') || undefined,
  })

  return ok(result)
}
