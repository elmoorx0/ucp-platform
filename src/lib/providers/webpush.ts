/**
 * Web Push Provider (VAPID)
 * Sends push notifications to browsers via the Web Push API.
 *
 * In production: install web-push package and pass VAPID keys.
 * In sandbox/dev: simulate the send.
 */

import { BaseProvider } from './base'
import type { ProviderName, ProviderCapabilities, SendRequest, SendResult } from '@/lib/types'
import { randomUUID } from 'crypto'

interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export class WebPushProvider extends BaseProvider {
  readonly name: ProviderName = 'webpush'
  readonly displayName = 'Web Push (VAPID)'
  readonly capabilities: ProviderCapabilities = {
    channels: ['webpush'],
    supportsBatch: false,
    supportsTemplate: false,
    supportsScheduled: false,
    maxRatePerSecond: 50,
  }

  private vapidSubject = ''
  private vapidPublicKey = ''
  private vapidPrivateKey = ''
  private useSimulation = true

  protected async onInitialize(): Promise<void> {
    this.vapidSubject = (this.credentials.vapidSubject as string) || ''
    this.vapidPublicKey = (this.credentials.vapidPublicKey as string) || ''
    this.vapidPrivateKey = (this.credentials.vapidPrivateKey as string) || ''
    this.useSimulation = !this.vapidPublicKey || !this.vapidPrivateKey
  }

  protected async onValidateCredentials(): Promise<boolean> {
    if (this.useSimulation) return true
    return !!(this.vapidSubject && this.vapidPublicKey && this.vapidPrivateKey)
  }

  async send(request: SendRequest): Promise<SendResult> {
    const subscription = request.subscription
    if (!subscription) {
      return {
        success: false,
        error: { code: 'MISSING_SUBSCRIPTION', message: 'Web Push requires a subscription object', retryable: false },
      }
    }

    const payload = JSON.stringify({
      title: request.title,
      body: request.body,
      icon: request.imageUrl,
      data: request.data || {},
      timestamp: Date.now(),
    })

    if (this.useSimulation) {
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 60))
      console.log(`[WebPush:SIM] endpoint=${(subscription as PushSubscription).endpoint}`)
      return {
        success: true,
        providerMessageId: `webpush_sim_${randomUUID()}`,
        metadata: { simulated: true, payloadSize: payload.length },
      }
    }

    // Real web-push implementation:
    // const webpush = require('web-push')
    // webpush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey)
    // const res = await webpush.sendNotification(subscription, payload)
    // return { success: true, providerMessageId: res.headers.location }
    return {
      success: false,
      error: {
        code: 'WEBPUSH_NOT_CONFIGURED',
        message: 'web-push package is not installed. Install it and provide VAPID keys.',
        retryable: false,
      },
    }
  }
}
