/**
 * Realtime Gateway Client
 * HTTP client for server-to-server push to the UCP Realtime Gateway.
 * NO POLLING — all communication is direct HTTP POST to /internal/push.
 *
 * Zero-config: If REALTIME_GATEWAY_URL is not set, gateway features are
 * gracefully disabled (in-app notifications will be persisted but not
 * delivered live). Set REALTIME_GATEWAY_URL to enable realtime.
 */

// Default to empty string — gateway features disabled if not set
const GATEWAY_BASE_URL = process.env.REALTIME_GATEWAY_URL || ''
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'ucp-internal-dev-token-change-me'

export type PushTarget = 'user' | 'channel' | 'project' | 'all' | 'socket'

export interface PushRequest {
  target: PushTarget
  projectId?: string
  channel?: string
  userId?: string
  socketId?: string
  event: string
  payload: unknown
}

export interface PushResponse {
  ok: boolean
  recipients: number
  event: string
}

/**
 * Push a message to the gateway. Fire-and-forget — if the gateway is down
 * or not configured, the message is logged but the notification still
 * persists in DB.
 */
export async function pushToGateway(req: PushRequest): Promise<PushResponse | null> {
  // If gateway URL is not set, skip silently
  if (!GATEWAY_BASE_URL) {
    return null
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(`${GATEWAY_BASE_URL}/internal/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INTERNAL_API_TOKEN}`,
      },
      body: JSON.stringify(req),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[GatewayClient] push failed: ${res.status} ${res.statusText}`)
      return null
    }
    return (await res.json()) as PushResponse
  } catch (e) {
    console.error('[GatewayClient] push error:', (e as Error).message)
    return null
  }
}

/**
 * Query the gateway for presence info (online users, user status).
 * Returns null if gateway is not configured or unreachable.
 */
export async function queryPresence(projectId: string, userId?: string): Promise<{
  user?: unknown
  users?: unknown[]
  count?: number
} | null> {
  if (!GATEWAY_BASE_URL) return null

  try {
    const url = new URL(`${GATEWAY_BASE_URL}/internal/presence`)
    url.searchParams.set('projectId', projectId)
    if (userId) url.searchParams.set('userId', userId)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${INTERNAL_API_TOKEN}` },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.error('[GatewayClient] presence query error:', (e as Error).message)
    return null
  }
}

/**
 * Check gateway health.
 * Returns null if gateway is not configured or unreachable.
 */
export async function gatewayHealthCheck(): Promise<{ ok: boolean; socketCount: number; presenceCount: number } | null> {
  if (!GATEWAY_BASE_URL) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${GATEWAY_BASE_URL}/health`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Check if the gateway is configured.
 */
export function isGatewayConfigured(): boolean {
  return !!GATEWAY_BASE_URL
}
