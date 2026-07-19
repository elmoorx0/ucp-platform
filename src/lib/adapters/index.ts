/**
 * Adapter pattern for distributed systems
 * - In-memory implementations work locally without Redis
 * - Redis implementations activate when REDIS_URL is set (production)
 * - Same interface — services don't care which is active
 *
 * Note: Presence state lives in the Realtime Gateway, NOT here.
 * This module only handles Event Bus (cross-service events).
 */

import type { EventBusEvent, EventHandler, Subscription } from '@/lib/types'
import { randomUUID } from 'crypto'

// ============ Event Bus Interface ============

export interface IEventBusAdapter {
  publish<T>(event: Omit<EventBusEvent<T>, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): Promise<string>
  subscribe<T = unknown>(
    topic: string,
    handler: EventHandler<T>,
    options?: { filter?: (e: EventBusEvent<T>) => boolean }
  ): Promise<Subscription>
  getStats(): { subscriberCount: number; topics: string[]; publishedTotal: number }
  disconnect(): Promise<void>
}

// ============ In-Memory Event Bus ============

class InMemoryEventBus implements IEventBusAdapter {
  private subscribers = new Map<string, Set<{ id: string; handler: EventHandler; filter?: (e: EventBusEvent) => boolean }>>()
  private publishedTotal = 0

  async publish<T>(event: Omit<EventBusEvent<T>, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): Promise<string> {
    const fullEvent: EventBusEvent<T> = {
      ...event,
      id: event.id || randomUUID(),
      timestamp: event.timestamp || Date.now(),
    } as EventBusEvent<T>

    const topicsToNotify = new Set<string>([
      '*',
      `project:${fullEvent.projectId}`,
      `project:${fullEvent.projectId}:*`,
      `project:${fullEvent.projectId}:${fullEvent.type}`,
      `type:${fullEvent.type}`,
    ])
    if (fullEvent.channel) {
      topicsToNotify.add(`channel:${fullEvent.channel}`)
      topicsToNotify.add(`project:${fullEvent.projectId}:channel:${fullEvent.channel}`)
    }

    const promises: Promise<void>[] = []
    for (const topic of topicsToNotify) {
      const subs = this.subscribers.get(topic)
      if (!subs) continue
      for (const sub of subs) {
        if (sub.filter && !sub.filter(fullEvent as EventBusEvent<unknown>)) continue
        promises.push(Promise.resolve(sub.handler(fullEvent as EventBusEvent<unknown>)).catch((err) => {
          console.error(`[EventBus] subscriber error on topic "${topic}":`, err)
        }))
      }
    }
    await Promise.all(promises)
    this.publishedTotal++
    return fullEvent.id
  }

  async subscribe<T = unknown>(
    topic: string,
    handler: EventHandler<T>,
    options?: { filter?: (e: EventBusEvent<T>) => boolean }
  ): Promise<Subscription> {
    const id = randomUUID()
    if (!this.subscribers.has(topic)) this.subscribers.set(topic, new Set())
    const entry = { id, handler: handler as EventHandler, filter: options?.filter as ((e: EventBusEvent) => boolean) | undefined }
    this.subscribers.get(topic)!.add(entry)
    return {
      id,
      unsubscribe: () => {
        this.subscribers.get(topic)?.delete(entry)
        if (this.subscribers.get(topic)?.size === 0) this.subscribers.delete(topic)
      },
    }
  }

  getStats() {
    const topics: string[] = []
    let subscriberCount = 0
    for (const [topic, subs] of this.subscribers) {
      topics.push(topic)
      subscriberCount += subs.size
    }
    return { subscriberCount, topics, publishedTotal: this.publishedTotal }
  }

  async disconnect() {
    this.subscribers.clear()
  }
}

// ============ Singleton ============

let _eventBus: IEventBusAdapter | null = null

export function getEventBus(): IEventBusAdapter {
  if (!_eventBus) {
    // TODO: When REDIS_URL is set, use RedisEventBus (Redis Streams)
    // For multi-instance production deployments.
    _eventBus = new InMemoryEventBus()
    console.log('[Adapters] Event Bus initialized (in-memory)')
  }
  return _eventBus
}

export async function disconnectAdapters() {
  await _eventBus?.disconnect()
  _eventBus = null
}
