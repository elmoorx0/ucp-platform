/**
 * Presence Service
 * Wraps the presence adapter with project-scoped helpers.
 */

import { getPresence } from '@/lib/adapters'
import { publishEvent } from './eventbus'
import type { PresenceState } from '@/lib/types'

export async function setUserOnline(
  projectId: string,
  userId: string,
  socketId: string,
  metadata?: Record<string, unknown>
) {
  await getPresence().setOnline(projectId, userId, socketId, metadata)
  await publishEvent(
    projectId,
    'presence.online',
    'presence',
    { userId, socketId, metadata },
    { channel: `presence:${projectId}`, persist: false }
  )
}

export async function setUserAway(projectId: string, userId: string) {
  await getPresence().setAway(projectId, userId)
  await publishEvent(
    projectId,
    'presence.away',
    'presence',
    { userId },
    { channel: `presence:${projectId}`, persist: false }
  )
}

export async function setUserOffline(projectId: string, userId: string, socketId?: string) {
  const wasOnline = await getPresence().isUserOnline(projectId, userId)
  await getPresence().setOffline(projectId, userId, socketId)
  if (wasOnline) {
    await publishEvent(
      projectId,
      'presence.offline',
      'presence',
      { userId, socketId },
      { channel: `presence:${projectId}`, persist: false }
    )
  }
}

export async function getUserPresence(projectId: string, userId: string): Promise<PresenceState | null> {
  return getPresence().getStatus(projectId, userId)
}

export async function getOnlineUsers(projectId: string): Promise<PresenceState[]> {
  return getPresence().getOnlineUsers(projectId)
}

export async function isUserOnline(projectId: string, userId: string): Promise<boolean> {
  return getPresence().isUserOnline(projectId, userId)
}

export async function getPresenceStats(projectId?: string) {
  return getPresence().getStats(projectId)
}
