/**
 * Base Provider abstraction
 * All notification providers implement this interface.
 * Adding a new provider = creating a new file that implements this.
 */

import type { Provider, ProviderName } from '@/lib/types'

export abstract class BaseProvider implements Provider {
  abstract readonly name: ProviderName
  abstract readonly displayName: string
  abstract readonly capabilities: import('@/lib/types').ProviderCapabilities

  protected credentials: Record<string, unknown> = {}
  protected config: Record<string, unknown> = {}
  protected initialized = false

  async initialize(credentials: Record<string, unknown>, config: Record<string, unknown> = {}): Promise<void> {
    this.credentials = credentials
    this.config = config
    await this.onInitialize()
    this.initialized = true
  }

  /** Subclass hook for custom initialization logic */
  protected async onInitialize(): Promise<void> {}

  async validateCredentials(): Promise<boolean> {
    if (!this.initialized) return false
    return this.onValidateCredentials()
  }

  protected abstract onValidateCredentials(): Promise<boolean>

  abstract send(request: import('@/lib/types').SendRequest): Promise<import('@/lib/types').SendResult>

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; details?: string }> {
    const start = Date.now()
    try {
      const valid = await this.validateCredentials()
      return { healthy: valid, latencyMs: Date.now() - start, details: valid ? 'OK' : 'Invalid credentials' }
    } catch (e) {
      return { healthy: false, latencyMs: Date.now() - start, details: (e as Error).message }
    }
  }

  async destroy?(): Promise<void> {}
}
