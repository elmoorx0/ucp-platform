/**
 * Webhook Retry Queue
 * Failed webhook deliveries are stored and retried with exponential backoff.
 *
 * Since we don't have a dedicated WebhookDelivery table in Prisma schema,
 * we use the AuditLog table as a queue:
 *   - action = 'webhook.delivery.failed'
 *   - resourceId = webhook URL
 *   - payload (in 'after' field) = the full webhook event
 *   - status = 'failed'
 *   - We retry by scanning for 'webhook.delivery.failed' entries created in the last hour
 *
 * For production with high webhook volume, add a dedicated WebhookDelivery model.
 */

import { db } from '@/lib/db'
import { sendWebhook, WebhookEvent } from './webhook'

const MAX_WEBHOOK_RETRIES = 5
const RETRY_DELAYS_HOURS = [0, 0.5, 2, 8, 24] // 0h, 30min, 2h, 8h, 24h

interface FailedWebhook {
  id: string
  projectId: string
  webhookUrl: string
  event: WebhookEvent
  attempts: number
  createdAt: Date
}

/**
 * Find failed webhook deliveries that are due for retry.
 * We use AuditLog entries with action='webhook.delivery.failed'.
 */
async function getFailedWebhooksForRetry(limit = 25): Promise<FailedWebhook[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // last 24h

  const logs = await db.auditLog.findMany({
    where: {
      action: 'webhook.delivery.failed',
      status: 'failed',
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  const failed: FailedWebhook[] = []
  for (const log of logs) {
    try {
      const meta = JSON.parse(log.after || '{}')
      const project = await db.project.findUnique({
        where: { id: log.resourceId || '' },
        select: { webhookUrl: true },
      })
      if (!project?.webhookUrl) continue

      // Calculate attempts from log message (we encode it there)
      const attemptsMatch = (log.message || '').match(/attempt=(\d+)/)
      const attempts = attemptsMatch ? parseInt(attemptsMatch[1], 10) : 1

      if (attempts >= MAX_WEBHOOK_RETRIES) continue

      // Check retry delay
      const delayHours = RETRY_DELAYS_HOURS[attempts] || 24
      const nextRetryAt = new Date(log.createdAt.getTime() + delayHours * 60 * 60 * 1000)
      if (new Date() < nextRetryAt) continue

      failed.push({
        id: log.id,
        projectId: log.resourceId || '',
        webhookUrl: project.webhookUrl,
        event: meta.event as WebhookEvent,
        attempts,
        createdAt: log.createdAt,
      })
    } catch {
      // skip malformed entries
      continue
    }
  }
  return failed
}

/**
 * Retry a single failed webhook delivery.
 */
async function retryFailedWebhook(fw: FailedWebhook): Promise<boolean> {
  const result = await sendWebhook(fw.projectId, fw.event)

  if (result.sent) {
    // Mark as succeeded
    await db.auditLog.update({
      where: { id: fw.id },
      data: {
        status: 'success',
        message: `attempt=${fw.attempts + 1} succeeded`,
      },
    })
    return true
  }

  // Still failing — update attempts in the message
  const newAttempts = fw.attempts + 1
  const willRetry = newAttempts < MAX_WEBHOOK_RETRIES
  await db.auditLog.update({
    where: { id: fw.id },
    data: {
      message: `attempt=${newAttempts}${willRetry ? ' will_retry' : ' giving_up'}`,
    },
  })
  return false
}

/**
 * Process all pending webhook retries.
 * Called by Vercel Cron.
 */
export async function processWebhookRetries(limit = 25): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const failed = await getFailedWebhooksForRetry(limit)
  let succeeded = 0
  let failedCount = 0

  for (const fw of failed) {
    const ok = await retryFailedWebhook(fw)
    if (ok) succeeded++
    else failedCount++
  }

  return { processed: failed.length, succeeded, failed: failedCount }
}

/**
 * Record a failed webhook delivery in the queue.
 * Called by the webhook service when initial delivery fails.
 */
export async function recordFailedWebhook(
  projectId: string,
  event: WebhookEvent,
  error?: string
): Promise<void> {
  await db.auditLog.create({
    data: {
      action: 'webhook.delivery.failed',
      resource: 'project',
      resourceId: projectId,
      after: JSON.stringify({ event, error }),
      status: 'failed',
      message: `attempt=1 failed: ${error || 'unknown error'}`,
    },
  })
}
