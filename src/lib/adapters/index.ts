/**
 * Adapter pattern for distributed systems
 * - In-memory implementations work locally without Redis
 * - Redis implementations activate when REDIS_URL is set
 * - Same interface — services don't care which is active
 */

import type { EventBusEvent, EventHandler, Subscription, PresenceState } from '@/lib/types'
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

// ============ Presence Adapter Interface ============

export interface IPresenceAdapter {
  setOnline(projectId: string, userId: string, socketId: string, metadata?: Record<string, unknown>): Promise<void>
  setAway(projectId: string, userId: string): Promise<void>
  setOffline(projectId: string, userId: string, socketId?: string): Promise<void>
  getStatus(projectId: string, userId: string): Promise<PresenceState | null>
  getOnlineUsers(projectId: string): Promise<PresenceState[]>
  isUserOnline(projectId: string, userId: string): Promise<boolean>
  getStats(projectId?: string): Promise<{ onlineCount: number; awayCount: number }>
  disconnect(): Promise<void>
}

// ============ Pub/Sub Adapter Interface (for Realtime horizontal scaling) ============

export interface IPubSubAdapter {
  publish(channel: string, message: unknown): Promise<void>
  subscribe(channel: string, handler: (message: unknown) => void): Promise<Subscription>
  publishBinary(channel: string, message: Buffer): Promise<void>
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

    // Topic can be: "*" (all), "project:{id}" (all events for project), "project:{id}:{type}", or "{type}"
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

// ============ In-Memory Presence ============

class InMemoryPresence implements IPresenceAdapter {
  // key: `${projectId}:${userId}` -> PresenceState (last socket wins, but track all socket ids)
  private states = new Map<string, PresenceState & { socketIds: Set<string> }>()

  private key(projectId: string, userId: string) {
    return `${projectId}:${userId}`
  }

  async setOnline(projectId: string, userId: string, socketId: string, metadata?: Record<string, unknown>) {
    const k = this.key(projectId, userId)
    const existing = this.states.get(k)
    if (existing) {
      existing.socketIds.add(socketId)
      existing.status = 'online'
      existing.lastSeenAt = Date.now()
      existing.metadata = { ...existing.metadata, ...metadata }
    } else {
      this.states.set(k, {
        userId,
        projectId,
        status: 'online',
        socketId,
        lastSeenAt: Date.now(),
        metadata,
        socketIds: new Set([socketId]),
      } as PresenceState & { socketIds: Set<string> })
    }
  }

  async setAway(projectId: string, userId: string) {
    const k = this.key(projectId, userId)
    const s = this.states.get(k)
    if (s) {
      s.status = 'away'
      s.lastSeenAt = Date.now()
    }
  }

  async setOffline(projectId: string, userId: string, socketId?: string) {
    const k = this.key(projectId, userId)
    const s = this.states.get(k)
    if (!s) return
    if (socketId) {
      s.socketIds.delete(socketId)
      if (s.socketIds.size > 0) return // still has other sessions
    }
    this.states.delete(k)
  }

  async getStatus(projectId: string, userId: string) {
    const k = this.key(projectId, userId)
    const s = this.states.get(k)
    if (!s) return null
    const { socketIds, ...rest } = s
    return rest
  }

  async getOnlineUsers(projectId: string) {
    const out: PresenceState[] = []
    for (const s of this.states.values()) {
      if (s.projectId === projectId && s.status !== 'offline') {
        const { socketIds, ...rest } = s
        out.push(rest)
      }
    }
    return out
  }

  async isUserOnline(projectId: string, userId: string) {
    const s = this.states.get(this.key(projectId, userId))
    return !!s && s.status !== 'offline' && s.socketIds.size > 0
  }

  async getStats(projectId?: string) {
    let onlineCount = 0
    let awayCount = 0
    for (const s of this.states.values()) {
      if (projectId && s.projectId !== projectId) continue
      if (s.status === 'online') onlineCount++
      else if (s.status === 'away') awayCount++
    }
    return { onlineCount, awayCount }
  }

  async disconnect() {
    this.states.clear()
  }
}

// ============ In-Memory PubSub (for Socket.io) ============

class InMemoryPubSub implements IPubSubAdapter {
  private channels = new Map<string, Set<(msg: unknown) => void>>()

  async publish(channel: string, message: unknown) {
    const subs = this.channels.get(channel)
    if (!subs) return
    for (const fn of subs) {
      try { fn(message) } catch (e) { console.error('[PubSub] subscriber error:', e) }
    }
  }

  async publishBinary(channel: string, message: Buffer) {
    await this.publish(channel, message)
  }

  async subscribe(channel: string, handler: (message: unknown) => void): Promise<Subscription> {
    if (!this.channels.has(channel)) this.channels.set(channel, new Set())
    this.channels.get(channel)!.add(handler)
    return {
      id: randomUUID(),
      unsubscribe: () => {
        this.channels.get(channel)?.delete(handler)
        if (this.channels.get(channel)?.size === 0) this.channels.delete(channel)
      },
    }
  }

  async disconnect() {
    this.channels.clear()
  }
}

// ============ Singleton Factories ============

let _eventBus: IEventBusAdapter | null = null
let _presence: IPresenceAdapter | null = null
let _pubsub: IPubSubAdapter | null = null

export function getEventBus(): IEventBusAdapter {
  if (!_eventBus) {
    // TODO: When REDIS_URL is set, use RedisEventBus (RedisStreams or Pub/Sub)
    // For now we use in-memory (single-instance). In production with multiple
    // Next.js / API instances, swap this for a Redis-backed implementation.
    _eventBus = new InMemoryEventBus()
    console.log('[Adapters] Event Bus initialized (in-memory)')
  }
  return _eventBus
}

export function getPresence(): IPresenceAdapter {
  if (!_presence) {
    _presence = new InMemoryPresence()
    console.log('[Adapters] Presence initialized (in-memory)')
  }
  return _presence
}

export function getPubSub(): IPubSubAdapter {
  if (!_pubsub) {
    _pubsub = new InMemoryPubSub()
    console.log('[Adapters] PubSub initialized (in-memory)')
  }
  return _pubsub
}

export async function disconnectAdapters() {
  await Promise.all([
    _eventBus?.disconnect(),
    _presence?.disconnect(),
    _pubsub?.disconnect(),
  ])
}
