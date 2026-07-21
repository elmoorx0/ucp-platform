/**
 * POST /api/internal/daily-tasks
 * Combined daily maintenance endpoint — runs all background tasks in one call.
 *
 * This is designed for Vercel Hobby plan which only allows 1 cron job per day.
 * It processes:
 *   1. Scheduled notifications (due for delivery)
 *   2. Failed notification retries (exponential backoff)
 *   3. Failed webhook delivery retries
 *
 * On Vercel Pro plan, you can switch back to separate crons with more frequent
 * schedules for near-real-time processing.
 *
 * Auth: Bearer INTERNAL_API_TOKEN (server-to-server only)
 *
 * Query params:
 *   - limit: batch size for each task (default 200, max 500)
 */

import { NextRequest, NextResponse } from 'next/server'
import { processScheduledNotifications } from '@/lib/services/scheduler'
import { processRetries } from '@/lib/services/retry'
import { processWebhookRetries } from '@/lib/services/webhook-retry'

const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'ucp-internal-dev-token-change-me'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${INTERNAL_API_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') || '200', 10)
  const clampedLimit = Math.min(Math.max(limit, 1), 500)

  const results = {
    scheduler: { processed: 0, succeeded: 0, failed: 0 },
    retry: { processed: 0, succeeded: 0, failed: 0 },
    webhookRetry: { processed: 0, succeeded: 0, failed: 0 },
    errors: [] as string[],
  }

  // 1. Process scheduled notifications
  try {
    results.scheduler = await processScheduledNotifications(clampedLimit)
  } catch (e) {
    results.errors.push(`Scheduler: ${(e as Error).message}`)
  }

  // 2. Retry failed notification deliveries
  try {
    results.retry = await processRetries(clampedLimit)
  } catch (e) {
    results.errors.push(`Retry: ${(e as Error).message}`)
  }

  // 3. Retry failed webhook deliveries
  try {
    results.webhookRetry = await processWebhookRetries(Math.min(clampedLimit, 200))
  } catch (e) {
    results.errors.push(`WebhookRetry: ${(e as Error).message}`)
  }

  const totalProcessed =
    results.scheduler.processed + results.retry.processed + results.webhookRetry.processed

  return NextResponse.json({
    success: true,
    totalProcessed,
    results,
    note: totalProcessed >= clampedLimit * 2
      ? 'High volume — consider upgrading to Vercel Pro for hourly crons, or trigger this endpoint manually more often.'
      : undefined,
  })
}
