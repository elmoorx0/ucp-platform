/**
 * Tests for crypto utilities
 */

import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  signDashboardToken,
  verifyDashboardToken,
  constantTimeCompare,
} from '../crypto'

describe('Password hashing', () => {
  it('should hash and verify a password', () => {
    const password = 'my-secret-password-123'
    const hashed = hashPassword(password)
    expect(hashed).not.toBe(password)
    expect(hashed.length).toBeGreaterThan(50)
    expect(verifyPassword(password, hashed)).toBe(true)
  })

  it('should reject wrong password', () => {
    const hashed = hashPassword('correct-password')
    expect(verifyPassword('wrong-password', hashed)).toBe(false)
  })

  it('should produce different hashes for same password (salt)', () => {
    const h1 = hashPassword('same')
    const h2 = hashPassword('same')
    expect(h1).not.toBe(h2)
  })
})

describe('API Key generation', () => {
  it('should generate a valid API key', () => {
    const { plaintext, hashedKey, keyPrefix } = generateApiKey()
    expect(plaintext).toMatch(/^ucp_live_[a-f0-9]+$/)
    expect(hashedKey).toMatch(/^[a-f0-9]+:[a-f0-9]+$/)
    expect(keyPrefix).toHaveLength(16)
    expect(plaintext.startsWith(keyPrefix)).toBe(true)
  })

  it('should generate test keys with different prefix', () => {
    const { plaintext } = generateApiKey(true)
    expect(plaintext).toMatch(/^ucp_test_/)
  })

  it('should verify a generated API key', () => {
    const { plaintext, hashedKey } = generateApiKey()
    expect(verifyApiKey(plaintext, hashedKey)).toBe(true)
  })

  it('should reject wrong API key', () => {
    const { hashedKey } = generateApiKey()
    expect(verifyApiKey('ucp_live_wrongkey', hashedKey)).toBe(false)
  })

  it('should produce unique hashes', () => {
    const h1 = hashApiKey('ucp_live_test')
    const h2 = hashApiKey('ucp_live_test')
    expect(h1).not.toBe(h2) // different salts
  })
})

describe('Dashboard JWT', () => {
  it('should sign and verify a dashboard token', () => {
    const payload = {
      sub: 'user-123',
      email: 'admin@test.com',
      role: 'super_admin',
      name: 'Admin',
    }
    const token = signDashboardToken(payload)
    expect(token.split('.').length).toBe(3) // header.payload.signature

    const verified = verifyDashboardToken(token)
    expect(verified).not.toBeNull()
    expect(verified?.sub).toBe(payload.sub)
    expect(verified?.email).toBe(payload.email)
    expect(verified?.role).toBe(payload.role)
    expect(verified?.name).toBe(payload.name)
  })

  it('should reject tampered token', () => {
    const token = signDashboardToken({ sub: 'u1', email: 'a@b.com', role: 'admin' })
    const parts = token.split('.')
    const tampered = parts[0] + '.' + parts[1] + '.invalid-signature'
    expect(verifyDashboardToken(tampered)).toBeNull()
  })

  it('should reject expired token', () => {
    const token = signDashboardToken({ sub: 'u1', email: 'a@b.com', role: 'admin' }, -1)
    expect(verifyDashboardToken(token)).toBeNull()
  })
})

describe('constantTimeCompare', () => {
  it('should return true for equal strings', () => {
    expect(constantTimeCompare('hello', 'hello')).toBe(true)
  })

  it('should return false for different strings', () => {
    expect(constantTimeCompare('hello', 'world')).toBe(false)
  })

  it('should return false for different lengths', () => {
    expect(constantTimeCompare('hello', 'hell')).toBe(false)
  })
})
