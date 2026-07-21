/**
 * Topic Subscriptions Service
 * Allows end users to subscribe/unsubscribe to notification topics.
 *
 * Topics are stored in EndUser.tags (reused for simplicity):
 *   - Subscribe to "marketing" → "topic:marketing" added to tags
 *   - Unsubscribe → "topic:marketing" removed from tags
 *
 * Send to a topic:
 *   POST /api/v1/notifications
 *   { "targetingType": "topic", "targetingData": { "topic": "marketing" }, ... }
 *
 * The Notification Service will find all users with "topic:marketing" in their tags.
 */

import { db } from '@/lib/db'

const TOPIC_PREFIX = 'topic:'

/**
 * Subscribe a user to a topic.
 */
export async function subscribeToTopic(
  projectId: string,
  externalUserId: string,
  topic: string
): Promise<{ subscribed: boolean; topic: string }> {
  // Normalize topic name
  const normalized = normalizeTopic(topic)
  const tag = `${TOPIC_PREFIX}${normalized}`

  // Find the user
  const user = await db.endUser.findFirst({
    where: { projectId, externalId: externalUserId },
    select: { id: true, tags: true },
  })

  if (!user) throw new Error('End user not found')

  const tags = JSON.parse(user.tags || '[]') as string[]
  if (!tags.includes(tag)) {
    tags.push(tag)
    await db.endUser.update({
      where: { id: user.id },
      data: { tags: JSON.stringify(tags) },
    })
  }

  return { subscribed: true, topic: normalized }
}

/**
 * Unsubscribe a user from a topic.
 */
export async function unsubscribeFromTopic(
  projectId: string,
  externalUserId: string,
  topic: string
): Promise<{ unsubscribed: boolean; topic: string }> {
  const normalized = normalizeTopic(topic)
  const tag = `${TOPIC_PREFIX}${normalized}`

  const user = await db.endUser.findFirst({
    where: { projectId, externalId: externalUserId },
    select: { id: true, tags: true },
  })

  if (!user) throw new Error('End user not found')

  const tags = JSON.parse(user.tags || '[]') as string[]
  const filtered = tags.filter((t) => t !== tag)

  if (filtered.length !== tags.length) {
    await db.endUser.update({
      where: { id: user.id },
      data: { tags: JSON.stringify(filtered) },
    })
  }

  return { unsubscribed: true, topic: normalized }
}

/**
 * Get all topics a user is subscribed to.
 */
export async function getUserTopics(
  projectId: string,
  externalUserId: string
): Promise<string[]> {
  const user = await db.endUser.findFirst({
    where: { projectId, externalId: externalUserId },
    select: { tags: true },
  })

  if (!user) return []

  const tags = JSON.parse(user.tags || '[]') as string[]
  return tags
    .filter((t) => t.startsWith(TOPIC_PREFIX))
    .map((t) => t.substring(TOPIC_PREFIX.length))
}

/**
 * Find all users subscribed to a topic.
 * Returns end user IDs.
 */
export async function getTopicSubscribers(projectId: string, topic: string): Promise<string[]> {
  const normalized = normalizeTopic(topic)
  const tag = `${TOPIC_PREFIX}${normalized}`

  const users = await db.endUser.findMany({
    where: {
      projectId,
      status: 'active',
      tags: { contains: tag },
    },
    select: { id: true },
  })

  return users.map((u) => u.id)
}

/**
 * Get subscriber count for a topic.
 */
export async function getTopicSubscriberCount(projectId: string, topic: string): Promise<number> {
  const normalized = normalizeTopic(topic)
  const tag = `${TOPIC_PREFIX}${normalized}`

  return db.endUser.count({
    where: {
      projectId,
      status: 'active',
      tags: { contains: tag },
    },
  })
}

/**
 * List all topics that have at least one subscriber in a project.
 */
export async function listProjectTopics(projectId: string): Promise<Array<{ topic: string; subscriberCount: number }>> {
  // Get all users with topic tags
  const users = await db.endUser.findMany({
    where: {
      projectId,
      status: 'active',
      tags: { contains: TOPIC_PREFIX },
    },
    select: { tags: true },
  })

  const topicCounts = new Map<string, number>()

  for (const user of users) {
    try {
      const tags = JSON.parse(user.tags || '[]') as string[]
      for (const tag of tags) {
        if (tag.startsWith(TOPIC_PREFIX)) {
          const topic = tag.substring(TOPIC_PREFIX.length)
          topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)
        }
      }
    } catch {
      // skip malformed
    }
  }

  return Array.from(topicCounts.entries())
    .map(([topic, subscriberCount]) => ({ topic, subscriberCount }))
    .sort((a, b) => b.subscriberCount - a.subscriberCount)
}

/**
 * Normalize a topic name: lowercase, trim, replace spaces with hyphens.
 */
function normalizeTopic(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}
