/**
 * GET /api/v1/templates
 * List available notification templates.
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok, badRequest } from '@/lib/middleware/auth'
import { listBuiltinTemplates } from '@/lib/services/templates'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')

  const templates = listBuiltinTemplates()
  return ok(templates)
}
