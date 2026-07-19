/**
 * In-App Provider
 * Stores notifications in DB and broadcasts them in realtime via Socket.io.
 * No external service required — fully functional.
 */

import { BaseProvider } from './base'
import type { ProviderName, ProviderCapabilities, SendRequest, SendResult } from '@/lib/types'
import { db } from '@/lib/db'
import { getEventBus } from '@/lib/adapters'
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
    return true // In-app always works
  }

  async send(request: SendRequest): Promise<SendResult> {
    const to = Array.isArray(request.to) ? request.to : [request.to]
    if (to.length === 0) {
      return { success: false, error: { code: 'MISSING_RECIPIENT', message: 'At least one recipient is required', retryable: false } }
    }

    const messageId = `inapp_${randomUUID()}`
    const eventBus = getEventBus()

    // Broadcast via event bus — realtime gateway will forward to connected clients
    for (const userId of to) {
      await eventBus.publish({
        projectId: (request.data?.projectId as string) || 'unknown',
        type: 'inapp.notification',
        source: 'notification',
        payload: {
          messageId,
          userId,
          title: request.title,
          body: request.body,
          imageUrl: request.imageUrl,
          data: request.data,
          timestamp: Date.now(),
        },
        channel: `user:${userId}`,
      })
    }

    return {
      success: true,
      providerMessageId: messageId,
      metadata: { recipients: to.length },
    }
  }

  async sendBatch(requests: SendRequest[]): Promise<SendResult[]> {
    return Promise.all(requests.map((r) => this.send(r)))
  }
}
