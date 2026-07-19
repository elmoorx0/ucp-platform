/**
 * FCM (Firebase Cloud Messaging) Provider
 * Sends push notifications to Android / iOS / Web via Firebase Admin SDK.
 *
 * In production: install firebase-admin and use the real SDK.
 * In sandbox/dev: we simulate the API call (no real push sent) so the
 * platform remains functional without external service account.
 */

import { BaseProvider } from './base'
import type { ProviderName, ProviderCapabilities, SendRequest, SendResult } from '@/lib/types'
import { randomUUID } from 'crypto'

export class FcmProvider extends BaseProvider {
  readonly name: ProviderName = 'fcm'
  readonly displayName = 'Firebase Cloud Messaging'
  readonly capabilities: ProviderCapabilities = {
    channels: ['push'],
    supportsBatch: true,
    supportsTemplate: false,
    supportsScheduled: false,
    maxRatePerSecond: 1000,
  }

  private serviceAccount: { projectId?: string; clientEmail?: string; privateKey?: string } = {}
  private useSimulation = true

  protected async onInitialize(): Promise<void> {
    this.serviceAccount = {
      projectId: this.credentials.projectId as string | undefined,
      clientEmail: this.credentials.clientEmail as string | undefined,
      privateKey: this.credentials.privateKey as string | undefined,
    }
    // If we have full credentials AND the firebase-admin package is available,
    // we can attempt real sends. Otherwise we simulate.
    this.useSimulation = !this.serviceAccount.projectId || !this.serviceAccount.privateKey
  }

  protected async onValidateCredentials(): Promise<boolean> {
    if (this.useSimulation) return true // Always OK in simulation mode
    return !!(this.serviceAccount.projectId && this.serviceAccount.clientEmail && this.serviceAccount.privateKey)
  }

  async send(request: SendRequest): Promise<SendResult> {
    const token = request.token || (typeof request.to === 'string' ? request.to : undefined)
    if (!token) {
      return {
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'FCM requires a device token', retryable: false },
      }
    }

    if (this.useSimulation) {
      // Simulate FCM send — 95% success rate
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 80))
      const ok = Math.random() > 0.05
      if (!ok) {
        return {
          success: false,
          error: { code: 'FCM_UNAVAILABLE', message: 'FCM service temporarily unavailable', retryable: true },
        }
      }
      return {
        success: true,
        providerMessageId: `fcm_sim_${randomUUID()}`,
        metadata: { simulated: true, token: token.substring(0, 12) + '...' },
      }
    }

    // Real FCM implementation (requires firebase-admin):
    // const admin = require('firebase-admin')
    // if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(this.serviceAccount) })
    // const msg = { notification: { title, body, imageUrl }, data, token, android: { priority: 'high' } }
    // const id = await admin.messaging().send(msg)
    // return { success: true, providerMessageId: id }
    return {
      success: false,
      error: {
        code: 'FCM_NOT_CONFIGURED',
        message: 'firebase-admin is not installed. Add the dependency and configure service account credentials.',
        retryable: false,
      },
    }
  }

  async sendBatch(requests: SendRequest[]): Promise<SendResult[]> {
    // FCM supports multicast — could be optimized. For now, sequential.
    const results: SendResult[] = []
    for (const r of requests) {
      results.push(await this.send(r))
    }
    return results
  }
}
