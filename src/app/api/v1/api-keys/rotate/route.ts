/**
 * POST /api/v1/api-keys/rotate
 * Rotate an API key — generates a new key while revoking the old one.
 * Useful for security compliance (e.g., rotate keys every 90 days).
 *
 * Auth: requires dashboard JWT (not API key auth — for security)
 *
 * Body:
 *   {
 *     "apiKeyId": "cmrr8...",
 *     "name": "(optional) new name for the rotated key"
 *   }
 *
 * Returns the new plaintext key (shown once).
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok, badRequest, forbidden } from '@/lib/middleware/auth'
import { db } from '@/lib/db'
import { generateApiKey } from '@/lib/crypto'
import { writeAuditLog } from '@/lib/services/identity'
import { getEventBus } from '@/lib/adapters'
import { invalidateProviderCache } from '@/lib/providers/registry'

export async function POST(req: NextRequest) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  if (ctx.role === 'viewer') return forbidden('Insufficient permissions')

  let body: { apiKeyId?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  if (!body.apiKeyId) return badRequest('apiKeyId is required')

  // Find the existing key
  const existing = await db.apiKey.findUnique({
    where: { id: body.apiKeyId },
    include: { project: { select: { id: true, tenantId: true } } },
  })

  if (!existing) return badRequest('API key not found')
  if (existing.status !== 'active') return badRequest('Cannot rotate a non-active key')

  // Verify tenant ownership
  if (existing.project.tenantId !== ctx.tenantId && ctx.role !== 'super_admin') {
    return forbidden('Not authorized to rotate this key')
  }

  // Generate new key
  const { plaintext, hashedKey, keyPrefix } = generateApiKey(false)

  // Update the existing key with new credentials (preserve ID, name, scopes)
  await db.apiKey.update({
    where: { id: existing.id },
    data: {
      hashedKey,
      keyPrefix,
      name: body.name || existing.name,
      lastUsedAt: null,
      lastUsedIp: null,
      // Reset status to active (in case it was about to expire)
      status: 'active',
    },
  })

  // Invalidate any cached provider instances that may have used the old key
  invalidateProviderCache(existing.projectId)

  // Audit log
  await writeAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'apikey.rotated',
    resource: 'api_key',
    resourceId: existing.id,
    before: { keyPrefix: existing.keyPrefix },
    after: { keyPrefix, name: body.name || existing.name },
    ip: req.headers.get('x-forwarded-for') || undefined,
    status: 'success',
  })

  // Emit event
  await getEventBus().publish({
    projectId: existing.projectId,
    type: 'apikey.rotated',
    source: 'identity',
    payload: { apiKeyId: existing.id, keyPrefix, name: body.name || existing.name },
  })

  return ok({
    id: existing.id,
    name: body.name || existing.name,
    keyPrefix,
    plaintext, // shown once
    message: 'API key rotated. Update your clients with the new key.',
  })
}
