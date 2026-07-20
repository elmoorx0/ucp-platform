/**
 * POST /api/internal/scheduler
 * Process scheduled notifications that are due.
 * Called by Vercel Cron every minute.
 *
 * Auth: Bearer INTERNAL_API_TOKEN (server-to-server only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { processScheduledNotifications } from '@/lib/services/scheduler'

const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'ucp-internal-dev-token-change-me'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${INTERNAL_API_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') || '50', 10)
  const clampedLimit = Math.min(Math.max(limit, 1), 500)

  try {
    const result = await processScheduledNotifications(clampedLimit)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[Internal Scheduler] error:', e)
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}

/**
 * GET /api/internal/scheduler
 * Preview due scheduled notifications without processing them.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${INTERNAL_API_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { getDueScheduledNotifications } = await import('@/lib/services/scheduler')
  const due = await getDueScheduledNotifications(50)

  return NextResponse.json({
    pending: due.length,
    notifications: due.map((n) => ({
      id: n.id,
      title: n.title,
      channel: n.channel,
      scheduledAt: n.scheduledAt,
      priority: n.priority,
    })),
  })
}
