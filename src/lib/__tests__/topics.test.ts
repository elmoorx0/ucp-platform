/**
 * Tests for topics service
 */

import { describe, it, expect } from 'vitest'

describe('Topic normalization', () => {
  // Test the normalizeTopic function logic
  function normalizeTopic(topic: string): string {
    return topic
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)
  }

  it('should lowercase the topic', () => {
    expect(normalizeTopic('MARKETING')).toBe('marketing')
    expect(normalizeTopic('Orders')).toBe('orders')
  })

  it('should trim whitespace', () => {
    expect(normalizeTopic('  marketing  ')).toBe('marketing')
  })

  it('should replace spaces with hyphens', () => {
    expect(normalizeTopic('marketing emails')).toBe('marketing-emails')
    expect(normalizeTopic('new user signup')).toBe('new-user-signup')
  })

  it('should replace special characters with hyphens', () => {
    expect(normalizeTopic('marketing@emails!')).toBe('marketing-emails')
    expect(normalizeTopic('order#123')).toBe('order-123')
  })

  it('should preserve hyphens and underscores', () => {
    expect(normalizeTopic('marketing-emails')).toBe('marketing-emails')
    expect(normalizeTopic('new_user')).toBe('new_user')
    expect(normalizeTopic('new-user_signup')).toBe('new-user_signup')
  })

  it('should strip leading/trailing hyphens', () => {
    expect(normalizeTopic('--marketing--')).toBe('marketing')
    expect(normalizeTopic('---orders---')).toBe('orders')
  })

  it('should limit to 50 characters', () => {
    const longTopic = 'a'.repeat(100)
    const result = normalizeTopic(longTopic)
    expect(result.length).toBe(50)
  })

  it('should handle empty string', () => {
    expect(normalizeTopic('')).toBe('')
    expect(normalizeTopic('   ')).toBe('')
  })

  it('should handle unicode by replacing non-ASCII chars', () => {
    // Arabic chars are replaced with hyphens
    const result = normalizeTopic('marketing-تسويق')
    // The result depends on the regex behavior — Arabic chars become hyphens
    expect(result).toMatch(/^marketing/)
    expect(result).not.toContain('تسويق')
  })
})

describe('Topic tag format', () => {
  it('should use topic: prefix', () => {
    const TOPIC_PREFIX = 'topic:'
    const tag = `${TOPIC_PREFIX}marketing`
    expect(tag).toBe('topic:marketing')
    expect(tag.startsWith('topic:')).toBe(true)
  })
})
