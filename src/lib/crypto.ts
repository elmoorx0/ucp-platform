/**
 * Crypto utilities for UCP
 * - JWT issuance & verification
 * - API key generation & hashing
 * - Password hashing (bcrypt-style using Node crypto)
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import jwt from 'next-auth/jwt'

// ============ Password Hashing (scrypt) ============

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = scryptSync(password, salt, 64).toString('hex')
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(test, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ============ API Key Generation ============

const KEY_PREFIX = 'ucp_live_'
const KEY_TEST_PREFIX = 'ucp_test_'

export interface GeneratedApiKey {
  /** Full plaintext key — only shown ONCE at creation time */
  plaintext: string
  /** Bcrypt-style hash to store in DB */
  hashedKey: string
  /** First 16 chars for display/identification */
  keyPrefix: string
}

export function generateApiKey(test = false): GeneratedApiKey {
  const prefix = test ? KEY_TEST_PREFIX : KEY_PREFIX
  const body = randomBytes(24).toString('hex')
  const plaintext = `${prefix}${body}`
  // Key prefix is what we show in UI (first 16 chars total)
  const keyPrefix = plaintext.substring(0, 16)
  // Hash for storage (using HMAC with server secret)
  const hashedKey = hashApiKey(plaintext)
  return { plaintext, hashedKey, keyPrefix }
}

export function hashApiKey(plaintext: string): string {
  const secret = process.env.API_KEY_HASH_SECRET || 'ucp-default-secret-change-in-prod'
  const salt = randomBytes(8).toString('hex')
  const hash = scryptSync(plaintext, `${secret}:${salt}`, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyApiKey(plaintext: string, hashedKey: string): boolean {
  const secret = process.env.API_KEY_HASH_SECRET || 'ucp-default-secret-change-in-prod'
  const [salt, hash] = hashedKey.split(':')
  if (!salt || !hash) return false
  const test = scryptSync(plaintext, `${secret}:${salt}`, 64).toString('hex')
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(test, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ============ JWT (for dashboard users) ============

const JWT_SECRET = process.env.JWT_SECRET || 'ucp-jwt-secret-change-in-prod'
const JWT_ISSUER = 'ucp-platform'
const JWT_AUDIENCE = 'ucp-dashboard'

export interface DashboardTokenPayload {
  sub: string // user id
  email: string
  role: string
  tenantId?: string
  name?: string
}

export function signDashboardToken(payload: DashboardTokenPayload, expiresInSec = 60 * 60 * 24 * 7): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = {
    ...payload,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + expiresInSec,
  }
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedBody = Buffer.from(JSON.stringify(body)).toString('base64url')
  const data = `${encodedHeader}.${encodedBody}`
  const signature = createHmac('sha256', JWT_SECRET).update(data).digest('base64url')
  return `${data}.${signature}`
}

export function verifyDashboardToken(token: string): DashboardTokenPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [encodedHeader, encodedBody, signature] = parts
    const data = `${encodedHeader}.${encodedBody}`
    const expectedSig = createHmac('sha256', JWT_SECRET).update(data).digest('base64url')
    const a = Buffer.from(signature)
    const b = Buffer.from(expectedSig)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const body = JSON.parse(Buffer.from(encodedBody, 'base64url').toString())
    if (body.exp && Math.floor(Date.now() / 1000) > body.exp) return null
    if (body.iss && body.iss !== JWT_ISSUER) return null
    return {
      sub: body.sub,
      email: body.email,
      role: body.role,
      tenantId: body.tenantId,
      name: body.name,
    }
  } catch {
    return null
  }
}

// ============ Misc ============

export function generateId(prefix = ''): string {
  return `${prefix}${randomBytes(8).toString('hex')}`
}

export function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
