/**
 * POST /api/internal/retry
 * Process pending notification retries. Called by Vercel Cron or external scheduler.
 *
 * Auth: Bearer INTERNAL_API_TOKEN (server-to-server only)
 *
 * Returns summary of processed retries.
 */

import { NextRequest, NextResponse } from 'next/server'
import { processRetries } from '@/lib/services/retry'

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
    const result = await processRetries(clampedLimit)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[Internal Retry] error:', e)
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}

/**
 * GET /api/internal/retry
 * Preview pending retries without processing them.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${INTERNAL_API_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { getTargetsForRetry } = await import('@/lib/services/retry')
  const targets = await getTargetsForRetry(50)

  return NextResponse.json({
    pending: targets.length,
    targets: targets.map((t) => ({
      targetId: t.targetId,
      notificationId: t.notificationId,
      channel: t.channel,
      attempts: t.attempts,
    })),
  })
}
