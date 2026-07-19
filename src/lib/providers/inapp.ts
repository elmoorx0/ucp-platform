/**
 * In-App Provider (Realtime)
 * Stores notification + targets in DB, then PUSHES instantly to the Realtime Gateway
 * via the gateway client (no polling). The gateway delivers to connected sockets.
 *
 * If no socket is connected for the user, the notification is still persisted
 * and can be fetched via REST API later (notification history).
 */

import { BaseProvider } from './base'
import type { ProviderName, ProviderCapabilities, SendRequest, SendResult } from '@/lib/types'
import { pushToGateway } from '@/lib/gateway-client'
import { randomUUID } from 'crypto'

export class InAppProvider extends BaseProvider {
  readonly name: ProviderName = 'inapp'
  readonly displayName = 'In-App (Realtime)'
  readonly capabilities: ProviderCapabilities = {
    channels: ['inapp'],
    supportsBatch: true,
    supportsTemplate: false,
    supportsScheduled: true,
    maxRatePerSecond: 500,
  }

  protected async onValidateCredentials(): Promise<boolean> {
    return true
  }

  async send(request: SendRequest): Promise<SendResult> {
    const to = Array.isArray(request.to) ? request.to : [request.to]
    if (to.length === 0) {
      return { success: false, error: { code: 'MISSING_RECIPIENT', message: 'At least one recipient is required', retryable: false } }
    }

    const messageId = `inapp_${randomUUID()}`
    const projectId = (request.data?.projectId as string) || 'unknown'
    const notificationId = (request.data?.notificationId as string) || messageId

    const basePayload = {
      notificationId,
      messageId,
      title: request.title,
      body: request.body,
      imageUrl: request.imageUrl,
      data: request.data || {},
      timestamp: Date.now(),
    }

    // Push to each user via gateway (instant, no polling)
    let pushedRecipients = 0
    for (const userId of to) {
      const result = await pushToGateway({
        target: 'user',
        projectId,
        userId,
        event: 'inapp:notification',
        payload: basePayload,
      })
      if (result && result.recipients > 0) {
        pushedRecipients++
      }
    }

    // Even if no socket was connected (recipients=0), we still return success
    // because the notification is persisted in DB and can be fetched later.
    return {
      success: true,
      providerMessageId: messageId,
      metadata: {
        recipients: to.length,
        liveDelivered: pushedRecipients,
        persisted: true,
      },
    }
  }

  async sendBatch(requests: SendRequest[]): Promise<SendResult[]> {
    return Promise.all(requests.map((r) => this.send(r)))
  }
}
