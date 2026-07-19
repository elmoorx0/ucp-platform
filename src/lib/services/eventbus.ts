/**
 * Event Bus Service
 * Wraps the adapter to provide higher-level helpers + persistence to DB.
 */

import { db } from '@/lib/db'
import { getEventBus } from '@/lib/adapters'
import type { EventBusEvent, EventHandler, Subscription } from '@/lib/types'
import { randomUUID } from 'crypto'

export interface PublishOptions {
  /** If true (default), persist the event to DB for replay/audit */
  persist?: boolean
  /** Channel name for filtering */
  channel?: string
}

export async function publishEvent<T>(
  projectId: string,
  type: string,
  source: string,
  payload: T,
  options: PublishOptions = {}
): Promise<string> {
  const eventBus = getEventBus()
  const id = await eventBus.publish<T>({
    projectId,
    type,
    source,
    payload,
    channel: options.channel,
  })

  if (options.persist !== false) {
    try {
      await db.event.create({
        data: {
          projectId,
          type,
          source,
          payload: JSON.stringify(payload),
          channel: options.channel,
        },
      })
    } catch (e) {
      console.error('[EventBus] failed to persist event:', e)
    }
  }
  return id
}

export async function subscribeToEvents<T = unknown>(
  topic: string,
  handler: EventHandler<T>,
  options?: { filter?: (e: EventBusEvent<T>) => boolean }
): Promise<Subscription> {
  return getEventBus().subscribe<T>(topic, handler, options)
}

export async function listEvents(
  projectId: string,
  filters: { type?: string; source?: string; channel?: string; page?: number; pageSize?: number } = {}
) {
  const page = filters.page || 1
  const pageSize = Math.min(filters.pageSize || 50, 200)
  const where: Record<string, unknown> = { projectId }
  if (filters.type) where.type = { contains: filters.type }
  if (filters.source) where.source = filters.source
  if (filters.channel) where.channel = filters.channel

  const [total, items] = await Promise.all([
    db.event.count({ where }),
    db.event.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function replayEvents(projectId: string, since: Date, handler: (e: EventBusEvent) => void) {
  const events = await db.event.findMany({
    where: { projectId, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
  })
  for (const e of events) {
    handler({
      id: e.id,
      projectId: e.projectId,
      type: e.type,
      source: e.source,
      payload: JSON.parse(e.payload || '{}'),
      channel: e.channel || undefined,
      timestamp: e.createdAt.getTime(),
    })
  }
  return events.length
}
