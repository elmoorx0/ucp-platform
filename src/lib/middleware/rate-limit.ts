/**
 * Rate Limiting Middleware
 * Sliding window rate limiter backed by DB (works in serverless environments).
 *
 * Each API key has a `rateLimitPerMin` field. We track request counts in the
 * AuditLog table (or a dedicated RateLimitLog table for performance).
 *
 * For high-throughput production, swap this for a Redis-backed limiter.
 */

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import type { ApiKeyContext } from '@/lib/types'

interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: Date
  retryAfterSec?: number
}

/**
 * Check rate limit for an API key.
 * Uses a sliding window: counts requests in the last 60 seconds.
 */
export async function checkRateLimit(ctx: ApiKeyContext): Promise<RateLimitResult> {
  const limit = ctx.rateLimitPerMin || 1000
  const now = new Date()
  const windowStart = new Date(now.getTime() - 60_000)

  // Count recent requests by this API key
  // Using AuditLog table — we add an entry per API call
  const recentCount = await db.auditLog.count({
    where: {
      apiKeyId: ctx.apiKeyId,
      createdAt: { gte: windowStart },
    },
  })

  const remaining = Math.max(0, limit - recentCount)
  const resetAt = new Date(now.getTime() + 60_000)

  if (recentCount >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt,
      retryAfterSec: 60,
    }
  }

  return { allowed: true, limit, remaining, resetAt }
}

/**
 * Middleware helper: check rate limit and return 429 response if exceeded.
 * Otherwise, write an audit log entry to count this request.
 */
export async function enforceRateLimit(
  req: NextRequest,
  ctx: ApiKeyContext,
  action: string
): Promise<NextResponse | null> {
  const rl = await checkRateLimit(ctx)

  if (!rl.allowed) {
    const res = NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit of ${rl.limit} requests/minute exceeded. Try again in ${rl.retryAfterSec} seconds.`,
        },
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(rl.resetAt.getTime() / 1000)),
          'Retry-After': String(rl.retryAfterSec || 60),
        },
      }
    )
    return res
  }

  // Log this request for rate limit counting (fire-and-forget)
  void db.auditLog.create({
    data: {
      apiKeyId: ctx.apiKeyId,
      action: `ratelimit.${action}`,
      resource: 'api',
      ip: ctx.ip,
      status: 'success',
      message: `${req.method} ${req.nextUrl.pathname}`,
    },
  }).catch(() => {
    // ignore logging errors — don't block the request
  })

  return null
}

/**
 * Helper to attach rate limit headers to a successful response.
 */
export function attachRateLimitHeaders(res: NextResponse, rl: RateLimitResult): NextResponse {
  res.headers.set('X-RateLimit-Limit', String(rl.limit))
  res.headers.set('X-RateLimit-Remaining', String(rl.remaining))
  res.headers.set('X-RateLimit-Reset', String(Math.floor(rl.resetAt.getTime() / 1000)))
  return res
}
