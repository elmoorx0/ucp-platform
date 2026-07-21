/**
 * POST /api/internal/scheduler
 * Process scheduled notifications that are due.
 *
 * On Vercel Hobby plan: runs once per hour (limited to daily crons, so
 * we process a larger batch each run with limit=500).
 * On Vercel Pro plan: can run every minute for near-real-time delivery.
 *
 * Auth: Bearer INTERNAL_API_TOKEN (server-to-server only)
 *
 * Query params:
 *   - limit: number of notifications to process (default 100, max 500)
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
  const limit = parseInt(url.searchParams.get('limit') || '100', 10)
  const clampedLimit = Math.min(Math.max(limit, 1), 500)

  try {
    const result = await processScheduledNotifications(clampedLimit)
    return NextResponse.json({
      success: true,
      ...result,
      note: result.processed >= clampedLimit
        ? 'Batch limit reached — more pending. Run again or upgrade to Vercel Pro for more frequent crons.'
        : undefined,
    })
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
  const due = await getDueScheduledNotifications(500)

  return NextResponse.json({
    pending: due.length,
    notifications: due.slice(0, 50).map((n) => ({
      id: n.id,
      title: n.title,
      channel: n.channel,
      scheduledAt: n.scheduledAt,
      priority: n.priority,
    })),
    note: due.length > 50 ? `${due.length - 50} more pending (showing first 50)` : undefined,
  })
}
