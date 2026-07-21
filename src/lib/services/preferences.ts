/**
 * Notification Preferences Service
 * Allows end users to opt-out of specific notification channels.
 *
 * Stored in EndUser.attributes as a JSON object:
 *   {
 *     "preferences": {
 *       "push": true,
 *       "email": true,
 *       "inapp": true,
 *       "webpush": false,
 *       "sms": true,
 *       "categories": {
 *         "marketing": false,
 *         "transactional": true,
 *         "security": true
 *       }
 *     }
 *   }
 *
 * The Notification Service checks these preferences before delivery.
 */

import { db } from '@/lib/db'
import type { ChannelType } from '@/lib/types'

export interface UserPreferences {
  /** Channel-level opt-in/opt-out */
  channels?: Record<ChannelType, boolean>
  /** Category-level opt-in/opt-out (e.g., marketing, transactional) */
  categories?: Record<string, boolean>
  /** Do Not Disturb — quiet hours (UTC, 24h format) */
  dnd?: {
    enabled: boolean
    startHour: number  // 0-23
    endHour: number    // 0-23
  }
}

const DEFAULT_PREFERENCES: UserPreferences = {
  channels: {
    push: true,
    email: true,
    inapp: true,
    webpush: true,
    sms: true,
  },
  categories: {},
  dnd: { enabled: false, startHour: 22, endHour: 8 },
}

/**
 * Get the notification preferences for a user.
 */
export async function getUserPreferences(projectId: string, endUserId: string): Promise<UserPreferences> {
  const user = await db.endUser.findFirst({
    where: { id: endUserId, projectId },
    select: { attributes: true },
  })

  if (!user) return DEFAULT_PREFERENCES

  try {
    const attrs = JSON.parse(user.attributes || '{}')
    const prefs = attrs.preferences as UserPreferences | undefined
    if (!prefs) return DEFAULT_PREFERENCES

    // Merge with defaults to ensure all fields exist
    return {
      channels: {
        push: prefs.channels?.push ?? true,
        email: prefs.channels?.email ?? true,
        inapp: prefs.channels?.inapp ?? true,
        webpush: prefs.channels?.webpush ?? true,
        sms: prefs.channels?.sms ?? true,
      },
      categories: prefs.categories || {},
      dnd: {
        enabled: prefs.dnd?.enabled ?? false,
        startHour: prefs.dnd?.startHour ?? 22,
        endHour: prefs.dnd?.endHour ?? 8,
      },
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

/**
 * Update notification preferences for a user.
 */
export async function updateUserPreferences(
  projectId: string,
  endUserId: string,
  preferences: Partial<UserPreferences>
): Promise<UserPreferences> {
  const user = await db.endUser.findFirst({
    where: { id: endUserId, projectId },
    select: { id: true, attributes: true },
  })

  if (!user) throw new Error('End user not found')

  const attrs = JSON.parse(user.attributes || '{}')
  const currentPrefs = (attrs.preferences as UserPreferences | undefined) || DEFAULT_PREFERENCES

  const updated: UserPreferences = {
    channels: {
      push: preferences.channels?.push ?? currentPrefs.channels?.push ?? true,
      email: preferences.channels?.email ?? currentPrefs.channels?.email ?? true,
      inapp: preferences.channels?.inapp ?? currentPrefs.channels?.inapp ?? true,
      webpush: preferences.channels?.webpush ?? currentPrefs.channels?.webpush ?? true,
      sms: preferences.channels?.sms ?? currentPrefs.channels?.sms ?? true,
    },
    categories: { ...currentPrefs.categories, ...preferences.categories },
    dnd: {
      enabled: preferences.dnd?.enabled ?? currentPrefs.dnd?.enabled ?? false,
      startHour: preferences.dnd?.startHour ?? currentPrefs.dnd?.startHour ?? 22,
      endHour: preferences.dnd?.endHour ?? currentPrefs.dnd?.endHour ?? 8,
    },
  }

  attrs.preferences = updated

  await db.endUser.update({
    where: { id: user.id },
    data: { attributes: JSON.stringify(attrs) },
  })

  return updated
}

/**
 * Check if a user has opted in to a specific channel.
 * Returns true if the user wants to receive notifications on this channel.
 */
export async function isChannelEnabled(
  projectId: string,
  endUserId: string,
  channel: ChannelType
): Promise<boolean> {
  const prefs = await getUserPreferences(projectId, endUserId)
  return prefs.channels?.[channel] ?? true
}

/**
 * Check if a user is within their Do Not Disturb window.
 */
export async function isInDndWindow(projectId: string, endUserId: string): Promise<boolean> {
  const prefs = await getUserPreferences(projectId, endUserId)
  if (!prefs.dnd?.enabled) return false

  const hour = new Date().getUTCHours()
  const { startHour, endHour } = prefs.dnd

  // Handle overnight window (e.g., 22:00 - 08:00)
  if (startHour > endHour) {
    return hour >= startHour || hour < endHour
  }
  // Same-day window (e.g., 13:00 - 17:00)
  return hour >= startHour && hour < endHour
}

/**
 * Filter a list of user IDs to only those who opted in to a channel.
 * Returns a map of userId -> isEnabled for inspection.
 */
export async function filterUsersByChannelPreference(
  projectId: string,
  endUserIds: string[],
  channel: ChannelType
): Promise<{ enabled: string[]; disabled: string[] }> {
  const enabled: string[] = []
  const disabled: string[] = []

  // Batch load all users
  const users = await db.endUser.findMany({
    where: { id: { in: endUserIds }, projectId },
    select: { id: true, attributes: true },
  })

  for (const user of users) {
    try {
      const attrs = JSON.parse(user.attributes || '{}')
      const prefs = attrs.preferences as UserPreferences | undefined
      const isOn = prefs?.channels?.[channel] ?? true
      if (isOn) enabled.push(user.id)
      else disabled.push(user.id)
    } catch {
      // Malformed attributes — default to enabled
      enabled.push(user.id)
    }
  }

  return { enabled, disabled }
}
