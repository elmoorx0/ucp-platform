/**
 * POST /api/dashboard/login
 * Authenticate dashboard user with email + password.
 * Returns JWT token to be stored in HTTP-only cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateDashboardUser } from '@/lib/services/identity'
import { signDashboardToken } from '@/lib/crypto'
import { ok, badRequest, unauthorized } from '@/lib/middleware/auth'

const DASHBOARD_COOKIE = 'ucp_dashboard_token'
const MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 days

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  if (!body.email || !body.password) {
    return badRequest('Email and password are required')
  }

  const user = await authenticateDashboardUser(body.email, body.password)
  if (!user) {
    return unauthorized('Invalid email or password')
  }

  const token = signDashboardToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId || undefined,
    name: user.name || undefined,
  })

  const response = NextResponse.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    },
  })
  response.cookies.set(DASHBOARD_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SEC,
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(DASHBOARD_COOKIE)
  return response
}
