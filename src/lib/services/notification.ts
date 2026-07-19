/**
 * Notification Service
 * - Accepts notification requests from API
 * - Resolves recipients (users, devices)
 * - Routes to correct provider
 * - Persists delivery state
 * - Emits events for tracking
 */

import { db } from '@/lib/db'
import { getEventBus } from '@/lib/adapters'
import { getProviderForChannelForProject } from '@/lib/providers/registry'
import type {
  NotificationInput,
  NotificationResult,
  NotificationStatus,
  ChannelType,
  ProviderName,
} from '@/lib/types'
import { writeAuditLog } from './identity'

// ============ Public API ============

export async function sendNotification(
  projectId: string,
  input: NotificationInput,
  ctx?: { apiKeyId?: string; userId?: string; tenantId?: string; ip?: string }
): Promise<NotificationResult> {
  // 1. Idempotency check (externalId)
  if (input.externalId) {
    const existing = await db.notification.findFirst({
      where: { projectId, externalId: input.externalId },
      include: { targets: true },
    })
    if (existing) {
      return toResult(existing, existing.targets)
    }
  }

  // 2. Resolve recipients -> targets (end users + devices)
  const targets = await resolveTargets(projectId, input)

  // 3. Create notification record
  const notification = await db.notification.create({
    data: {
      projectId,
      channel: input.channel,
      title: input.title,
      body: input.body,
      imageUrl: input.imageUrl,
      data: JSON.stringify(input.data || {}),
      targetingType: input.targetingType || 'user',
      targetingData: JSON.stringify(input.targetingData || {}),
      providerName: input.providerName,
      status: targets.length === 0 ? 'failed' : 'sending',
      priority: input.priority || 'normal',
      scheduledAt: input.scheduledAt,
      totalTargets: targets.length,
      pendingCount: targets.length,
      externalId: input.externalId,
      metadata: JSON.stringify({ source: ctx?.apiKeyId ? 'api' : 'dashboard' }),
    },
  })

  if (targets.length === 0) {
    await db.notification.update({
      where: { id: notification.id },
      data: { status: 'failed', metadata: JSON.stringify({ error: 'No targets resolved' }) },
    })
    return toResult(notification, [])
  }

  // 4. Create target records
  const targetRows = await Promise.all(
    targets.map((t) =>
      db.notificationTarget.create({
        data: {
          notificationId: notification.id,
          endUserId: t.endUserId,
          deviceId: t.deviceId,
          channel: t.channel,
          providerName: t.providerName,
          status: 'pending',
        },
      })
    )
  )

  // 5. Emit event
  await getEventBus().publish({
    projectId,
    type: 'notification.queued',
    source: 'notification',
    payload: {
      notificationId: notification.id,
      title: notification.title,
      totalTargets: targets.length,
      channel: notification.channel,
    },
  })

  // 6. Process delivery (async, fire-and-forget — we return immediately with pending status)
  // For high-throughput, this would be enqueued to a worker. For now, we process in background.
  processDelivery(projectId, notification.id, targetRows.map((t) => ({ ...t, channel: t.channel as ChannelType }))).catch((err) => {
    console.error(`[Notification] delivery failed for ${notification.id}:`, err)
  })

  // 7. Audit
  await writeAuditLog({
    tenantId: ctx?.tenantId,
    userId: ctx?.userId,
    apiKeyId: ctx?.apiKeyId,
    action: 'notification.sent',
    resource: 'notification',
    resourceId: notification.id,
    after: { title: notification.title, totalTargets: targets.length, channel: notification.channel },
    ip: ctx?.ip,
    status: 'success',
  })

  return toResult(notification, targetRows)
}

export async function getNotification(projectId: string, notificationId: string) {
  const n = await db.notification.findFirst({
    where: { id: notificationId, projectId },
    include: { targets: { include: { device: { select: { platform: true } } } } },
  })
  if (!n) return null
  return toResult(n, n.targets)
}

export async function listNotifications(
  projectId: string,
  filters: { status?: string; channel?: string; page?: number; pageSize?: number } = {}
) {
  const page = filters.page || 1
  const pageSize = Math.min(filters.pageSize || 20, 100)
  const where: Record<string, unknown> = { projectId }
  if (filters.status) where.status = filters.status
  if (filters.channel) where.channel = filters.channel

  const [total, items] = await Promise.all([
    db.notification.count({ where }),
    db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function cancelNotification(projectId: string, notificationId: string) {
  const n = await db.notification.findFirst({ where: { id: notificationId, projectId } })
  if (!n) throw new Error('Notification not found')
  if (['sent', 'delivered', 'cancelled'].includes(n.status)) {
    throw new Error(`Cannot cancel notification in status "${n.status}"`)
  }
  await db.notification.update({ where: { id: notificationId }, data: { status: 'cancelled' } })
  await db.notificationTarget.updateMany({
    where: { notificationId, status: 'pending' },
    data: { status: 'failed', lastError: 'cancelled by user' },
  })
  return getNotification(projectId, notificationId)
}

// ============ Internal: target resolution ============

interface ResolvedTarget {
  endUserId?: string
  deviceId?: string
  channel: ChannelType
  providerName: ProviderName
}

async function resolveTargets(projectId: string, input: NotificationInput): Promise<ResolvedTarget[]> {
  const targets: ResolvedTarget[] = []
  const targeting = input.targetingData || {}
  const targetingType = input.targetingType || 'user'

  if (targetingType === 'broadcast') {
    // Send to all end users of the project
    const users = await db.endUser.findMany({ where: { projectId, status: 'active' } })
    for (const u of users) {
      targets.push(...(await targetsForUser(projectId, u.id, input)))
    }
    return targets
  }

  if (targetingType === 'topic') {
    // Topic broadcast — would need a topic subscription model. For now we use the topic as a tag.
    const topic = targeting.topic
    if (!topic) return []
    const users = await db.endUser.findMany({
      where: { projectId, status: 'active', tags: { contains: topic } },
    })
    for (const u of users) {
      targets.push(...(await targetsForUser(projectId, u.id, input)))
    }
    return targets
  }

  // user targeting (default)
  const externalIds = targeting.externalUserIds || []
  const userIds = targeting.userIds || []

  // If only "to" was passed via the API, externalUserIds will be set
  if (externalIds.length === 0 && userIds.length === 0) {
    return targets
  }

  const users = await db.endUser.findMany({
    where: {
      projectId,
      OR: [
        ...(externalIds.length > 0 ? [{ externalId: { in: externalIds } }] : []),
        ...(userIds.length > 0 ? [{ id: { in: userIds } }] : []),
      ],
    },
  })

  for (const u of users) {
    targets.push(...(await targetsForUser(projectId, u.id, input)))
  }
  return targets
}

async function targetsForUser(
  projectId: string,
  endUserId: string,
  input: NotificationInput
): Promise<ResolvedTarget[]> {
  const out: ResolvedTarget[] = []

  if (input.channel === 'multi') {
    // Resolve to all configured channels for this user
    const channels: ChannelType[] = ['inapp', 'push', 'email', 'webpush']
    for (const ch of channels) {
      const providerName = pickProviderForChannel(ch, input.providerName)
      if (ch === 'inapp') {
        out.push({ endUserId, channel: 'inapp', providerName })
      } else {
        // Find user's device for this channel
        const devices = await db.device.findMany({
          where: { endUserId, status: 'active', platform: ch === 'webpush' ? 'web' : { in: ['android', 'ios'] } },
        })
        for (const d of devices) {
          if (ch === 'webpush' && !d.pushSubscription) continue
          out.push({ endUserId, deviceId: d.id, channel: ch, providerName })
        }
      }
    }
    return out
  }

  const channel = input.channel as ChannelType
  const providerName = pickProviderForChannel(channel, input.providerName)

  if (channel === 'inapp') {
    out.push({ endUserId, channel, providerName })
    return out
  }

  // Find user's devices for this channel
  const devices = await db.device.findMany({
    where: {
      endUserId,
      status: 'active',
      ...(channel === 'push'
        ? { platform: { in: ['android', 'ios'] } }
        : channel === 'webpush'
        ? { platform: 'web', NOT: { pushSubscription: null } }
        : {}),
    },
  })
  for (const d of devices) {
    out.push({ endUserId, deviceId: d.id, channel, providerName })
  }

  // If channel is email and user has email, add email target without device
  if (channel === 'email') {
    const user = await db.endUser.findUnique({ where: { id: endUserId } })
    if (user?.email) {
      out.push({ endUserId, channel, providerName })
    }
  }

  return out
}

function pickProviderForChannel(channel: ChannelType, preferred?: ProviderName): ProviderName {
  if (preferred) return preferred
  const map: Record<ChannelType, ProviderName> = {
    push: 'fcm',
    email: 'email_smtp',
    inapp: 'inapp',
    webpush: 'webpush',
    sms: 'twilio',
  }
  return map[channel]
}

// ============ Internal: delivery ============

async function processDelivery(
  projectId: string,
  notificationId: string,
  targets: Array<{ id: string; endUserId: string | null; deviceId: string | null; channel: ChannelType; providerName: string | null }>
) {
  let delivered = 0
  let failed = 0
  let pending = targets.length

  await db.notification.update({ where: { id: notificationId }, data: { status: 'sending' } })

  for (const target of targets) {
    try {
      // Load full target with relations
      const full = await db.notificationTarget.findUnique({
        where: { id: target.id },
        include: {
          device: true,
          endUser: true,
          notification: true,
        },
      })
      if (!full || full.status !== 'pending') continue

      const provider = await getProviderForChannelForProject(
        projectId,
        target.channel,
        (target.providerName as ProviderName) || undefined
      )

      // Build send request
      const notification = full.notification
      const sendReq: import('@/lib/types').SendRequest = {
        to: full.endUser?.externalId || full.endUserId || '',
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl || undefined,
        data: { ...JSON.parse(notification.data || '{}'), notificationId, projectId, targetId: target.id },
        email: full.endUser?.email || undefined,
        token: full.device?.token,
        subscription: full.device?.pushSubscription ? JSON.parse(full.device.pushSubscription) : undefined,
      }

      const result = await provider.send(sendReq)
      pending--
      if (result.success) {
        delivered++
        await db.notificationTarget.update({
          where: { id: target.id },
          data: {
            status: 'sent',
            providerMessageId: result.providerMessageId,
            attempts: { increment: 1 },
            deliveredAt: new Date(),
          },
        })
        await getEventBus().publish({
          projectId,
          type: 'notification.target.sent',
          source: 'notification',
          payload: { notificationId, targetId: target.id, channel: target.channel, providerMessageId: result.providerMessageId },
        })
      } else {
        failed++
        await db.notificationTarget.update({
          where: { id: target.id },
          data: {
            status: 'failed',
            lastError: result.error?.message || 'Unknown error',
            attempts: { increment: 1 },
          },
        })
        await getEventBus().publish({
          projectId,
          type: 'notification.target.failed',
          source: 'notification',
          payload: { notificationId, targetId: target.id, channel: target.channel, error: result.error },
        })
      }
    } catch (e) {
      failed++
      pending--
      await db.notificationTarget.update({
        where: { id: target.id },
        data: { status: 'failed', lastError: (e as Error).message, attempts: { increment: 1 } },
      })
    }

    // Update parent notification stats periodically
    await db.notification.update({
      where: { id: notificationId },
      data: {
        deliveredCount: delivered,
        failedCount: failed,
        pendingCount: pending,
      },
    })
  }

  // Final status
  const finalStatus: NotificationStatus =
    delivered === 0 && failed > 0 ? 'failed' :
    failed === 0 ? 'sent' :
    'partial'

  await db.notification.update({
    where: { id: notificationId },
    data: { status: finalStatus, sentAt: new Date(), pendingCount: 0 },
  })

  await getEventBus().publish({
    projectId,
    type: 'notification.completed',
    source: 'notification',
    payload: { notificationId, status: finalStatus, delivered, failed },
  })
}

// ============ Helpers ============

function toResult(
  n: import('@prisma/client').Notification & { targets?: import('@prisma/client').NotificationTarget[] },
  targets: import('@prisma/client').NotificationTarget[]
): NotificationResult {
  return {
    id: n.id,
    status: n.status as NotificationStatus,
    totalTargets: n.totalTargets,
    delivered: n.deliveredCount,
    failed: n.failedCount,
    pending: n.pendingCount,
    targets: targets.map((t) => ({
      id: t.id,
      endUserId: t.endUserId || undefined,
      deviceId: t.deviceId || undefined,
      channel: t.channel as ChannelType,
      status: t.status,
      error: t.lastError || undefined,
      providerMessageId: t.providerMessageId || undefined,
    })),
  }
}

// ============ Stats ============

export async function getNotificationStats(projectId: string, days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const [total, byStatus, byChannel, recent] = await Promise.all([
    db.notification.count({ where: { projectId } }),
    db.notification.groupBy({ by: ['status'], where: { projectId }, _count: true }),
    db.notification.groupBy({ by: ['channel'], where: { projectId, createdAt: { gte: since } }, _count: true }),
    db.notification.findMany({
      where: { projectId, createdAt: { gte: since } },
      select: { status: true, channel: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return {
    total,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count })),
    recent: recent.map((r) => ({ status: r.status, channel: r.channel, date: r.createdAt })),
  }
}
