/**
 * Tests for rate-limit service
 */

import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { getNextRetryAt, getMaxAttempts } from '../services/retry'
import { signPayload, verifySignature } from '../services/webhook'

describe('Retry service', () => {
  it('should return next retry time for valid attempts', () => {
    const retry0 = getNextRetryAt(0)
    const retry1 = getNextRetryAt(1)
    const retry4 = getNextRetryAt(4)

    expect(retry0).toBeInstanceOf(Date)
    expect(retry1).toBeInstanceOf(Date)
    expect(retry4).toBeInstanceOf(Date)

    // Later attempts should be later in time
    expect(retry1!.getTime()).toBeGreaterThan(retry0!.getTime())
    expect(retry4!.getTime()).toBeGreaterThan(retry1!.getTime())
  })

  it('should return null when max attempts exceeded', () => {
    const max = getMaxAttempts()
    expect(getNextRetryAt(max)).toBeNull()
    expect(getNextRetryAt(max + 1)).toBeNull()
    expect(getNextRetryAt(100)).toBeNull()
  })

  it('should return max attempts = 5', () => {
    expect(getMaxAttempts()).toBe(5)
  })
})

describe('Webhook signature', () => {
  const secret = 'test-secret-123'
  const payload = JSON.stringify({ event: 'notification.sent', data: { id: '123' } })

  it('should sign and verify a payload', () => {
    const signature = signPayload(payload)
    expect(signature).toMatch(/^sha256=[a-f0-9]+$/)
    // signPayload uses process.env.INTERNAL_API_TOKEN; verify with same secret
    expect(verifySignature(payload, signature)).toBe(true)
  })

  it('should reject wrong signature', () => {
    const wrongSig = 'sha256=wrong'
    expect(verifySignature(payload, wrongSig, secret)).toBe(false)
  })

  it('should accept valid signature with explicit secret', () => {
    const validSig = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
    expect(verifySignature(payload, validSig, secret)).toBe(true)
  })

  it('should reject tampered payload', () => {
    const validSig = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
    const tampered = payload + 'tampered'
    expect(verifySignature(tampered, validSig, secret)).toBe(false)
  })
})
