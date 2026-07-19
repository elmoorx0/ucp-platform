/**
 * API Middleware for UCP
 * - Extracts & verifies API key from request
 * - Extracts & verifies dashboard JWT from cookies
 * - Returns AuthContext or null
 * - Role & scope checking helpers
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyApiKeyFromRequest } from '@/lib/services/identity'
import { verifyDashboardToken } from '@/lib/crypto'
import type { AuthContext, ApiKeyContext, DashboardUserContext } from '@/lib/types'
import { db } from '@/lib/db'

// ============ API Key Extraction ============

const API_KEY_HEADERS = ['x-api-key', 'x-ucp-key', 'authorization']
const API_KEY_PREFIXES = ['ucp_live_', 'ucp_test_', 'Bearer ucp_']

export function extractApiKey(req: NextRequest): string | null {
  // 1. Try headers
  for (const header of API_KEY_HEADERS) {
    const val = req.headers.get(header)
    if (!val) continue
    if (header === 'authorization') {
      // "Bearer ucp_live_..." or just the key
      const cleaned = val.replace(/^Bearer\s+/i, '')
      if (cleaned.startsWith('ucp_')) return cleaned
    } else if (val.startsWith('ucp_')) {
      return val
    }
  }
  // 2. Try query param (less secure, but supported for convenience)
  const queryKey = req.nextUrl.searchParams.get('api_key')
  if (queryKey && queryKey.startsWith('ucp_')) return queryKey
  return null
}

export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyContext | null> {
  const rawKey = extractApiKey(req)
  if (!rawKey) return null
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined
  return verifyApiKeyFromRequest(rawKey, ip || undefined)
}

// ============ Dashboard JWT ============

const DASHBOARD_COOKIE = 'ucp_dashboard_token'

export function getDashboardToken(req: NextRequest): string | undefined {
  // 1. Try cookie
  const cookie = req.cookies.get(DASHBOARD_COOKIE)?.value
  if (cookie) return cookie
  // 2. Try Authorization header
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.substring(7)
    if (token.split('.').length === 3) return token
  }
  return undefined
}

export async function authenticateDashboard(req: NextRequest): Promise<DashboardUserContext | null> {
  const token = getDashboardToken(req)
  if (!token) return null
  const payload = verifyDashboardToken(token)
  if (!payload) return null
  // Verify user still exists & active
  const user = await db.user.findUnique({ where: { id: payload.sub } })
  if (!user || user.status !== 'active') return null
  return {
    userId: user.id,
    email: user.email,
    name: user.name || undefined,
    role: user.role,
    tenantId: user.tenantId || undefined,
  }
}

// ============ Combined ============

export async function authenticate(req: NextRequest): Promise<AuthContext | null> {
  // Try API key first (for programmatic clients)
  const apiKeyCtx = await authenticateApiKey(req)
  if (apiKeyCtx) return apiKeyCtx
  // Then dashboard JWT
  const dashboardCtx = await authenticateDashboard(req)
  if (dashboardCtx) return dashboardCtx
  return null
}

// ============ Response helpers ============

export function unauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message } }, { status: 401 })
}

export function forbidden(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message } }, { status: 403 })
}

export function badRequest(message: string, code = 'BAD_REQUEST'): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status: 400 })
}

export function notFound(message = 'Not Found'): NextResponse {
  return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message } }, { status: 404 })
}

export function ok<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: true, data, meta })
}

// ============ Scope / Permission helpers ============

const SCOPE_WILDCARD = '*'

export function hasScope(ctx: ApiKeyContext, requiredScope: string): boolean {
  if (ctx.scopes.includes(SCOPE_WILDCARD)) return true
  // "notifications:send" matches "notifications:*" or "*"
  for (const scope of ctx.scopes) {
    if (scope === requiredScope) return true
    if (scope.endsWith(':*') && requiredScope.startsWith(scope.substring(0, scope.length - 1))) return true
  }
  return false
}

export function requireScope(ctx: AuthContext, scope: string): NextResponse | null {
  if (!('apiKeyId' in ctx)) return null // Dashboard users bypass scope checks
  if (!hasScope(ctx, scope)) {
    return forbidden(`Missing required scope: ${scope}`)
  }
  return null
}

export function requireRole(ctx: AuthContext, roles: string[]): NextResponse | null {
  if ('role' in ctx) {
    if (!roles.includes(ctx.role) && ctx.role !== 'super_admin') {
      return forbidden(`Requires one of roles: ${roles.join(', ')}`)
    }
  }
  return null
}
