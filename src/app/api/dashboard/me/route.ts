/**
 * GET /api/dashboard/me
 * Returns current authenticated user info.
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok } from '@/lib/middleware/auth'

export async function GET(req: NextRequest) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  return ok(ctx)
}
