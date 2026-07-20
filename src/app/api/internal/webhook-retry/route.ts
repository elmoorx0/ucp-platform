/**
 * POST /api/internal/webhook-retry
 * Retry failed webhook deliveries.
 * Called by Vercel Cron every 30 minutes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { processWebhookRetries } from '@/lib/services/webhook-retry'

const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'ucp-internal-dev-token-change-me'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${INTERNAL_API_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') || '25', 10)

  try {
    const result = await processWebhookRetries(limit)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[Webhook Retry] error:', e)
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}
