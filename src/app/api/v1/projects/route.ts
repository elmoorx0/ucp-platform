/**
 * GET /api/v1/projects
 * Returns the project info associated with the current API key.
 */

import { NextRequest } from 'next/server'
import { authenticate, unauthorized, ok } from '@/lib/middleware/auth'
import { getProject } from '@/lib/services/identity'

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized('API key or dashboard token required')

  if ('apiKeyId' in ctx) {
    const project = await getProject(ctx.projectId)
    if (!project) return ok(null)
    return ok({
      id: project.id,
      name: project.name,
      slug: project.slug,
      status: project.status,
      description: project.description,
      createdAt: project.createdAt,
    })
  }

  // For dashboard users, require projectId in query
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return ok(null)
  const project = await getProject(projectId)
  return ok(project)
}
