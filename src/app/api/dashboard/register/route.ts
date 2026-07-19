/**
 * POST /api/dashboard/register
 * Register a new dashboard user (only first user becomes super_admin; rest need invitation).
 */

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { createDashboardUser } from '@/lib/services/identity'
import { ok, badRequest } from '@/lib/middleware/auth'

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; name?: string; tenantName?: string }
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  if (!body.email || !body.password) {
    return badRequest('Email and password are required')
  }
  if (body.password.length < 8) {
    return badRequest('Password must be at least 8 characters')
  }

  // Check if any super_admin exists
  const existingAdminCount = await db.user.count({ where: { role: 'super_admin' } })
  const isFirstUser = existingAdminCount === 0

  // If not first user, they need an invitation (we'll add invitations later). For now, allow signup as viewer with a default tenant.
  let tenantId: string | undefined
  let role = 'viewer'

  if (isFirstUser) {
    // Create default tenant for first user
    const tenant = await db.tenant.create({
      data: { name: body.tenantName || 'Default Organization', slug: 'default', plan: 'enterprise' },
    })
    tenantId = tenant.id
    role = 'super_admin'
  } else {
    // Find default tenant
    const defaultTenant = await db.tenant.findUnique({ where: { slug: 'default' } })
    if (defaultTenant) tenantId = defaultTenant.id
  }

  try {
    const user = await createDashboardUser({
      email: body.email,
      password: body.password,
      name: body.name,
      role,
      tenantId,
    })
    return ok({ user, isFirstUser })
  } catch (e) {
    return badRequest((e as Error).message, 'REGISTER_FAILED')
  }
}
