/**
 * GET /api/dashboard/projects
 * List projects for the current tenant.
 * POST /api/dashboard/projects
 * Create a new project.
 */

import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok, badRequest } from '@/lib/middleware/auth'
import { listProjects, createProject, getProject } from '@/lib/services/identity'

export async function GET(req: NextRequest) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  if (!ctx.tenantId) return badRequest('No tenant associated with user')

  const projects = await listProjects(ctx.tenantId)
  return ok(projects)
}

export async function POST(req: NextRequest) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  if (!ctx.tenantId) return badRequest('No tenant associated with user')

  let body: { name?: string; description?: string; slug?: string }
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }
  if (!body.name) return badRequest('name is required')

  const project = await createProject({
    tenantId: ctx.tenantId,
    name: body.name,
    description: body.description,
    slug: body.slug,
  })
  return ok(project)
}
