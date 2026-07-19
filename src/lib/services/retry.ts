/**
 * Retry Service
 * Implements exponential backoff retry for failed notification deliveries.
 *
 * Used by the Notification Service to retry failed targets.
 *
 * Schedule:
 *   - Attempt 1: immediate
 *   - Attempt 2: after 30 seconds
 *   - Attempt 3: after 2 minutes
 *   - Attempt 4: after 10 minutes
 *   - Attempt 5: after 1 hour
 *   - Give up after 5 attempts (mark as 'failed' permanently)
 */

import { db } from '@/lib/db'
import { getProviderForChannelForProject } from '@/lib/providers/registry'
import type { ChannelType, ProviderName } from '@/lib/types'
import { writeAuditLog } from './identity'

// Retry delays in seconds (cumulative from initial send)
const RETRY_DELAYS_SEC = [0, 30, 120, 600, 3600] // 5 attempts total
const MAX_ATTEMPTS = 5

export interface RetryableTarget {
  targetId: string
  notificationId: string
  projectId: string
  endUserId?: string | null
  deviceId?: string | null
  channel: ChannelType
  providerName?: ProviderName | null
  attempts: number
}

/**
 * Calculate the next retry time based on attempt count.
 * Returns null if max attempts exceeded.
 */
export function getNextRetryAt(attempts: number): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null
  const delaySec = RETRY_DELAYS_SEC[attempts] || 3600
  return new Date(Date.now() + delaySec * 1000)
}

/**
 * Get the maximum number of attempts allowed.
 */
export function getMaxAttempts(): number {
  return MAX_ATTEMPTS
}

/**
 * Get all targets that are due for retry (status=failed, attempts < MAX, no nextRetryAt or nextRetryAt <= now).
 * Called by a background worker (cron or long-running process).
 *
 * In Vercel serverless, this would be triggered by a Vercel Cron job hitting
 * an internal endpoint.
 */
export async function getTargetsForRetry(limit = 50): Promise<RetryableTarget[]> {
  const now = new Date()
  // Find failed targets that haven't exceeded max attempts
  // We use the attempts field — if attempts < MAX, retry is allowed
  const targets = await db.notificationTarget.findMany({
    where: {
      status: 'failed',
      attempts: { lt: MAX_ATTEMPTS },
      // Don't retry invalid devices (token expired, etc.)
      AND: [
        { lastError: { not: { contains: 'MISSING_TOKEN' } } },
        { lastError: { not: { contains: 'InvalidApiKey' } } },
      ],
      // Add a small delay between retries — updatedAt should be at least 30s ago
      updatedAt: { lt: new Date(now.getTime() - 30_000) },
    },
    include: {
      notification: {
        select: {
          id: true,
          projectId: true,
          title: true,
          body: true,
          imageUrl: true,
          data: true,
        },
      },
      device: { select: { token: true, pushSubscription: true, platform: true } },
      endUser: { select: { externalId: true, email: true } },
    },
    take: limit,
    orderBy: { updatedAt: 'asc' },
  })

  return targets.map((t) => ({
    targetId: t.id,
    notificationId: t.notificationId,
    projectId: t.notification.projectId,
    endUserId: t.endUserId,
    deviceId: t.deviceId,
    channel: t.channel as ChannelType,
    providerName: t.providerName as ProviderName | null,
    attempts: t.attempts,
  }))
}

/**
 * Retry a single failed target.
 * Returns true if retry succeeded, false if still failing.
 */
export async function retryTarget(target: RetryableTarget): Promise<boolean> {
  try {
    // Load full target with relations
    const full = await db.notificationTarget.findUnique({
      where: { id: target.targetId },
      include: {
        device: true,
        endUser: true,
        notification: true,
      },
    })
    if (!full || full.status !== 'failed') return false

    const provider = await getProviderForChannelForProject(
      target.projectId,
      target.channel,
      target.providerName || undefined
    )

    const notification = full.notification
    const sendReq: import('@/lib/types').SendRequest = {
      to: full.endUser?.externalId || full.endUserId || '',
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl || undefined,
      data: { ...JSON.parse(notification.data || '{}'), notificationId: target.notificationId, targetId: target.targetId },
      email: full.endUser?.email || undefined,
      token: full.device?.token,
      subscription: full.device?.pushSubscription ? JSON.parse(full.device.pushSubscription) : undefined,
    }

    const result = await provider.send(sendReq)

    if (result.success) {
      // Mark as sent
      await db.notificationTarget.update({
        where: { id: target.targetId },
        data: {
          status: 'sent',
          providerMessageId: result.providerMessageId,
          attempts: { increment: 1 },
          deliveredAt: new Date(),
          lastError: null,
        },
      })

      // Update parent notification stats
      await db.notification.update({
        where: { id: target.notificationId },
        data: {
          deliveredCount: { increment: 1 },
          failedCount: { decrement: 1 },
        },
      })

      await writeAuditLog({
        action: 'notification.retry.succeeded',
        resource: 'notification_target',
        resourceId: target.targetId,
        message: `Project: ${target.projectId}`,
        after: { attempts: target.attempts + 1 },
        status: 'success',
      })

      return true
    } else {
      // Still failing — increment attempts, schedule next retry
      const newAttempts = target.attempts + 1
      const willRetry = newAttempts < MAX_ATTEMPTS

      await db.notificationTarget.update({
        where: { id: target.targetId },
        data: {
          attempts: newAttempts,
          lastError: result.error?.message || 'Unknown error',
          // If not retryable error, give up immediately
          status: result.error && !result.error.retryable ? 'failed' : 'failed',
        },
      })

      await writeAuditLog({
        action: 'notification.retry.failed',
        resource: 'notification_target',
        resourceId: target.targetId,
        message: `Project: ${target.projectId}`,
        after: { attempts: newAttempts, willRetry, error: result.error },
        status: 'failed',
      })

      return false
    }
  } catch (e) {
    console.error(`[Retry] error retrying target ${target.targetId}:`, e)
    return false
  }
}

/**
 * Process a batch of retries. Returns summary.
 */
export async function processRetries(limit = 50): Promise<{ processed: number; succeeded: number; failed: number }> {
  const targets = await getTargetsForRetry(limit)
  let succeeded = 0
  let failed = 0

  for (const target of targets) {
    const ok = await retryTarget(target)
    if (ok) succeeded++
    else failed++
  }

  return { processed: targets.length, succeeded, failed }
}
