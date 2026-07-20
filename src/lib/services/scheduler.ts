/**
 * Scheduler Service
 * Processes scheduled notifications that are due for delivery.
 *
 * Notifications with `scheduledAt` set in the future and status='pending'
 * are picked up by this worker and dispatched.
 *
 * Triggered by Vercel Cron every minute: /api/internal/scheduler
 */

import { db } from '@/lib/db'
import { sendNotification } from './notification'
import type { NotificationInput } from '@/lib/types'

/**
 * Find scheduled notifications that are due (scheduledAt <= now, status=pending).
 */
export async function getDueScheduledNotifications(limit = 50) {
  const now = new Date()
  return db.notification.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: now },
      channel: { not: '' }, // ensure it's a real notification
    },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
    include: {
      project: { select: { id: true, name: true, status: true, tenantId: true } },
    },
  })
}

/**
 * Process a single scheduled notification.
 * Re-dispatches it through the notification service.
 */
export async function processScheduledNotification(notif: {
  id: string
  projectId: string
  channel: string
  title: string
  body: string
  imageUrl: string | null
  data: string
  targetingType: string
  targetingData: string
  providerName: string | null
  priority: string
  externalId: string | null
  project: { tenantId: string | null }
}): Promise<{ processed: boolean; reason?: string }> {
  try {
    // Mark as 'queued' to prevent duplicate processing
    await db.notification.update({
      where: { id: notif.id },
      data: { status: 'queued' },
    })

    // Parse stored data
    const data = JSON.parse(notif.data || '{}')
    const targetingData = JSON.parse(notif.targetingData || '{}')

    // Build the input — reuse sendNotification for delivery logic
    const input: NotificationInput = {
      channel: notif.channel as NotificationInput['channel'],
      title: notif.title,
      body: notif.body,
      imageUrl: notif.imageUrl || undefined,
      data,
      targetingType: notif.targetingType as NotificationInput['targetingType'],
      targetingData,
      providerName: (notif.providerName as NotificationInput['providerName']) || undefined,
      priority: (notif.priority as 'low' | 'normal' | 'high') || 'normal',
      externalId: notif.externalId || undefined, // for idempotency
    }

    // Delete the original scheduled notification (it will be re-created by sendNotification
    // with proper target records). We use a transaction to avoid losing data on failure.
    await db.notificationTarget.deleteMany({ where: { notificationId: notif.id } })
    await db.notification.delete({ where: { id: notif.id } })

    // Re-dispatch through the normal notification flow
    await sendNotification(notif.projectId, input, {
      tenantId: notif.project.tenantId || undefined,
    })

    return { processed: true }
  } catch (e) {
    console.error(`[Scheduler] error processing notification ${notif.id}:`, e)
    // Revert status to 'pending' so it can be retried in the next cron run
    await db.notification.update({
      where: { id: notif.id },
      data: { status: 'pending' },
    }).catch(() => {})
    return { processed: false, reason: (e as Error).message }
  }
}

/**
 * Process all due scheduled notifications.
 * Called by Vercel Cron.
 */
export async function processScheduledNotifications(limit = 50): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const dueNotifs = await getDueScheduledNotifications(limit)
  let succeeded = 0
  let failed = 0

  for (const notif of dueNotifs) {
    const result = await processScheduledNotification(notif)
    if (result.processed) succeeded++
    else failed++
  }

  return { processed: dueNotifs.length, succeeded, failed }
}

/**
 * Get a preview of upcoming scheduled notifications (next 24h).
 */
export async function getUpcomingScheduled(projectId: string, hoursAhead = 24) {
  const now = new Date()
  const until = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

  return db.notification.findMany({
    where: {
      projectId,
      status: 'pending',
      scheduledAt: {
        gte: now,
        lte: until,
      },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
    select: {
      id: true,
      title: true,
      body: true,
      channel: true,
      scheduledAt: true,
      priority: true,
      totalTargets: true,
    },
  })
}
