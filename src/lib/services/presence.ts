/**
 * Presence Service
 * Delegates to the Realtime Gateway via HTTP (no in-memory state in Next.js).
 * The gateway is the single source of truth for online state.
 */

import { queryPresence } from '@/lib/gateway-client'
import { publishEvent } from './eventbus'
import type { PresenceState } from '@/lib/types'

export async function getUserPresence(projectId: string, userId: string): Promise<PresenceState | null> {
  const result = await queryPresence(projectId, userId)
  if (!result || !result.user) return null
  return result.user as PresenceState
}

export async function getOnlineUsers(projectId: string): Promise<PresenceState[]> {
  const result = await queryPresence(projectId)
  if (!result || !result.users) return []
  return result.users as PresenceState[]
}

export async function isUserOnline(projectId: string, userId: string): Promise<boolean> {
  const state = await getUserPresence(projectId, userId)
  return !!state && state.status === 'online'
}

export async function getPresenceStats(projectId?: string) {
  if (!projectId) {
    // No global stats available without projectId — return zeros
    return { onlineCount: 0, awayCount: 0 }
  }
  const users = await getOnlineUsers(projectId)
  const onlineCount = users.filter((u) => u.status === 'online').length
  const awayCount = users.filter((u) => u.status === 'away').length
  return { onlineCount, awayCount }
}

// Note: setOnline/setAway/setOffline are NOT available here — they happen
// automatically when a socket connects/disconnects at the gateway level.
// The Next.js API cannot directly set presence; only socket events do.
// To broadcast a presence-related event, use the event bus:
export async function broadcastPresenceUpdate(projectId: string, userId: string, status: 'online' | 'away' | 'offline') {
  await publishEvent(
    projectId,
    'presence.update',
    'presence',
    { userId, status, timestamp: Date.now() },
    { channel: `presence:${projectId}`, persist: false }
  )
}
