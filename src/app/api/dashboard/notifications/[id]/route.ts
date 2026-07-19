import { NextRequest } from 'next/server'
import { authenticateDashboard, unauthorized, ok, badRequest, notFound } from '@/lib/middleware/auth'
import { getNotification, cancelNotification } from '@/lib/services/notification'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  const { id } = await params
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')
  const result = await getNotification(projectId, id)
  if (!result) return notFound('Notification not found')
  return ok(result)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticateDashboard(req)
  if (!ctx) return unauthorized('Not authenticated')
  const { id } = await params
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return badRequest('projectId is required')
  try {
    const result = await cancelNotification(projectId, id)
    return ok(result)
  } catch (e) {
    return badRequest((e as Error).message)
  }
}
