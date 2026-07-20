/**
 * Webhook Service
 * Sends delivery receipts to client webhook URLs.
 *
 * When a notification is delivered (or failed), we POST the receipt to
 * the project's webhookUrl (if configured).
 *
 * Webhook payload format:
 *   {
 *     "event": "notification.delivered" | "notification.failed" | "notification.sent",
 *     "timestamp": "2026-01-01T00:00:00.000Z",
 *     "data": {
 *       "notificationId": "...",
 *       "targetId": "...",
 *       "channel": "push" | "email" | "inapp" | "webpush",
 *       "status": "sent" | "delivered" | "failed",
 *       "endUserId": "...",
 *       "providerMessageId": "...",
 *       "error": { "code": "...", "message": "..." } | null,
 *       "attempts": 1
 *     }
 *   }
 *
 * Security:
 *   - Each webhook request is signed with HMAC-SHA256 using INTERNAL_API_TOKEN
 *   - Signature is sent in `X-UCP-Signature` header
 *   - Clients should verify the signature before processing
 */

import { createHmac } from 'crypto'
import { db } from '@/lib/db'

export interface WebhookEvent {
  event: 'notification.sent' | 'notification.delivered' | 'notification.failed' | 'notification.read' | 'notification.clicked'
  timestamp: string
  data: {
    notificationId: string
    targetId: string
    projectId: string
    channel: string
    status: string
    endUserId?: string | null
    deviceId?: string | null
    providerMessageId?: string | null
    error?: { code: string; message: string } | null
    attempts: number
  }
}

/**
 * Send a webhook event to the project's webhook URL.
 * Fire-and-forget — failures don't affect the main notification flow.
 */
export async function sendWebhook(
  projectId: string,
  event: WebhookEvent
): Promise<{ sent: boolean; status?: number; error?: string }> {
  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { webhookUrl: true, name: true },
    })

    if (!project?.webhookUrl) {
      return { sent: false }
    }

    // Validate URL
    let url: URL
    try {
      url = new URL(project.webhookUrl)
    } catch {
      console.error(`[Webhook] invalid URL for project ${projectId}: ${project.webhookUrl}`)
      return { sent: false, error: 'Invalid webhook URL' }
    }

    // Only allow HTTPS in production (allow HTTP for localhost dev)
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      console.error(`[Webhook] refusing to send to non-HTTPS URL: ${project.webhookUrl}`)
      return { sent: false, error: 'Only HTTPS allowed in production' }
    }

    const payload = JSON.stringify(event)
    const signature = signPayload(payload)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const res = await fetch(project.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-UCP-Signature': signature,
        'X-UCP-Event': event.event,
        'User-Agent': 'UCP-Webhook/1.0',
      },
      body: payload,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[Webhook] ${project.name} returned ${res.status} ${res.statusText}`)
    }

    return { sent: res.ok, status: res.status }
  } catch (e) {
    console.error(`[Webhook] error sending to project ${projectId}:`, (e as Error).message)
    return { sent: false, error: (e as Error).message }
  }
}

/**
 * Sign a webhook payload with HMAC-SHA256.
 * Clients verify using their INTERNAL_API_TOKEN.
 */
export function signPayload(payload: string): string {
  const secret = process.env.INTERNAL_API_TOKEN || 'ucp-internal-dev-token-change-me'
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Verify a webhook signature (for client SDK use).
 * Pass the same secret used to sign the payload (INTERNAL_API_TOKEN).
 */
export function verifySignature(payload: string, signature: string, secret?: string): boolean {
  const actualSecret = secret || process.env.INTERNAL_API_TOKEN || 'ucp-internal-dev-token-change-me'
  // Compute expected signature using the provided secret
  const expected = 'sha256=' + createHmac('sha256', actualSecret).update(payload).digest('hex')
  // Constant-time comparison
  const expectedBuf = Buffer.from(expected)
  const actualBuf = Buffer.from(signature)
  if (expectedBuf.length !== actualBuf.length) return false
  let diff = 0
  for (let i = 0; i < expectedBuf.length; i++) {
    diff |= expectedBuf[i] ^ actualBuf[i]
  }
  return diff === 0
}

/**
 * Helper: notify client about notification delivery.
 */
export async function notifyDelivery(
  projectId: string,
  notificationId: string,
  targetId: string,
  channel: string,
  status: string,
  options: {
    endUserId?: string | null
    deviceId?: string | null
    providerMessageId?: string | null
    error?: { code: string; message: string } | null
    attempts?: number
  } = {}
): Promise<void> {
  const event: WebhookEvent = {
    event: status === 'failed' ? 'notification.failed' :
           status === 'delivered' ? 'notification.delivered' :
           'notification.sent',
    timestamp: new Date().toISOString(),
    data: {
      notificationId,
      targetId,
      projectId,
      channel,
      status,
      endUserId: options.endUserId || null,
      deviceId: options.deviceId || null,
      providerMessageId: options.providerMessageId || null,
      error: options.error || null,
      attempts: options.attempts || 1,
    },
  }

  // Fire-and-forget
  void sendWebhook(projectId, event)
}
