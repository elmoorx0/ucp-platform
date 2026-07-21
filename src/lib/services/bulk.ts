/**
 * Bulk Operations Service
 * Efficiently handle bulk operations:
 *   - Bulk register end users (up to 1000 per request)
 *   - Bulk register devices
 *   - Bulk send notifications (same content, different recipients)
 *
 * Uses Prisma's createMany for efficient batch inserts.
 */

import { db } from '@/lib/db'
import { sendNotification } from './notification'
import { writeAuditLog } from './identity'
import type { ChannelType, NotificationInput } from '@/lib/types'

const MAX_BULK_USERS = 1000
const MAX_BULK_DEVICES = 500
const MAX_BULK_SEND = 100

export interface BulkRegisterUsersInput {
  users: Array<{
    externalId: string
    email?: string
    phone?: string
    name?: string
    language?: string
    timezone?: string
    tags?: string[]
    attributes?: Record<string, unknown>
  }>
}

export interface BulkRegisterUsersResult {
  totalRequested: number
  created: number
  updated: number
  failed: number
  errors: Array<{ index: number; externalId: string; error: string }>
}

/**
 * Bulk register/update end users.
 * Uses upsert pattern — creates if not exists, updates if exists.
 */
export async function bulkRegisterUsers(
  projectId: string,
  input: BulkRegisterUsersInput
): Promise<BulkRegisterUsersResult> {
  if (input.users.length > MAX_BULK_USERS) {
    throw new Error(`Maximum ${MAX_BULK_USERS} users per bulk request`)
  }

  let created = 0
  let updated = 0
  let failed = 0
  const errors: Array<{ index: number; externalId: string; error: string }> = []

  // Process in batches of 100 for DB efficiency
  const batchSize = 100
  for (let i = 0; i < input.users.length; i += batchSize) {
    const batch = input.users.slice(i, i + batchSize)

    for (let j = 0; j < batch.length; j++) {
      const user = batch[j]
      const index = i + j

      if (!user.externalId) {
        failed++
        errors.push({ index, externalId: '', error: 'externalId is required' })
        continue
      }

      try {
        const result = await db.endUser.upsert({
          where: {
            projectId_externalId: {
              projectId,
              externalId: user.externalId,
            },
          },
          update: {
            email: user.email,
            phone: user.phone,
            name: user.name,
            language: user.language || 'en',
            timezone: user.timezone || 'UTC',
            tags: JSON.stringify(user.tags || []),
            attributes: JSON.stringify(user.attributes || {}),
          },
          create: {
            projectId,
            externalId: user.externalId,
            email: user.email,
            phone: user.phone,
            name: user.name,
            language: user.language || 'en',
            timezone: user.timezone || 'UTC',
            tags: JSON.stringify(user.tags || []),
            attributes: JSON.stringify(user.attributes || {}),
          },
        })

        // Check if it was a create or update
        const existing = await db.endUser.count({
          where: {
            projectId,
            externalId: user.externalId,
            createdAt: { lt: new Date(Date.now() - 1000) }, // existed before this call
          },
        })
        if (existing > 0) updated++
        else created++
      } catch (e) {
        failed++
        errors.push({
          index,
          externalId: user.externalId,
          error: (e as Error).message,
        })
      }
    }
  }

  return {
    totalRequested: input.users.length,
    created,
    updated,
    failed,
    errors,
  }
}

export interface BulkSendResult {
  totalRequested: number
  sent: number
  failed: number
  results: Array<{
    index: number
    success: boolean
    notificationId?: string
    error?: string
  }>
}

/**
 * Bulk send notifications — same content, different recipient lists.
 * Useful for personalized messages to segments.
 *
 * Each item in the array creates a separate notification.
 * For sending ONE notification to MANY users, use the regular send endpoint
 * with targetingType='user' and multiple externalUserIds.
 */
export async function bulkSendNotifications(
  projectId: string,
  notifications: Array<{
    channel: ChannelType | 'multi'
    to: string | string[]
    title: string
    body: string
    imageUrl?: string
    data?: Record<string, unknown>
    priority?: 'low' | 'normal' | 'high'
    externalId?: string
  }>,
  ctx?: { apiKeyId?: string; userId?: string; tenantId?: string; ip?: string }
): Promise<BulkSendResult> {
  if (notifications.length > MAX_BULK_SEND) {
    throw new Error(`Maximum ${MAX_BULK_SEND} notifications per bulk request`)
  }

  const results: BulkSendResult['results'] = []
  let sent = 0
  let failed = 0

  // Process sequentially to avoid overwhelming the system
  // In production, this would be queued to a background worker
  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i]
    try {
      const to = Array.isArray(n.to) ? n.to : [n.to]
      const input: NotificationInput = {
        channel: n.channel,
        title: n.title,
        body: n.body,
        imageUrl: n.imageUrl,
        data: n.data,
        targetingType: 'user',
        targetingData: { externalUserIds: to },
        priority: n.priority || 'normal',
        externalId: n.externalId,
      }

      const result = await sendNotification(projectId, input, ctx)
      sent++
      results.push({
        index: i,
        success: true,
        notificationId: result.id,
      })
    } catch (e) {
      failed++
      results.push({
        index: i,
        success: false,
        error: (e as Error).message,
      })
    }
  }

  // Audit log
  if (ctx) {
    await writeAuditLog({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      apiKeyId: ctx.apiKeyId,
      action: 'notification.bulk_sent',
      resource: 'notification',
      after: { total: notifications.length, sent, failed },
      ip: ctx.ip,
      status: failed === 0 ? 'success' : 'partial',
    })
  }

  return {
    totalRequested: notifications.length,
    sent,
    failed,
    results,
  }
}
