/**
 * Provider Registry
 * - Registers all available providers
 * - Resolves the right provider for a given channel
 * - Caches initialized provider instances per project
 */

import type { Provider, ProviderName, ChannelType } from '@/lib/types'
import { db } from '@/lib/db'
import { FcmProvider } from './fcm'
import { EmailSmtpProvider } from './email-smtp'
import { WebPushProvider } from './webpush'
import { InAppProvider } from './inapp'

// ============ Registry ============

const PROVIDER_FACTORIES: Record<ProviderName, () => Provider> = {
  fcm: () => new FcmProvider(),
  email_smtp: () => new EmailSmtpProvider(),
  webpush: () => new WebPushProvider(),
  inapp: () => new InAppProvider(),
  onesignal: () => {
    throw new Error('OneSignal provider not implemented yet — add to providers/ folder')
  },
  twilio: () => {
    throw new Error('Twilio provider not implemented yet — add to providers/ folder')
  },
}

// Map channels to default provider names
const CHANNEL_DEFAULT_PROVIDER: Record<ChannelType, ProviderName> = {
  push: 'fcm',
  email: 'email_smtp',
  inapp: 'inapp',
  webpush: 'webpush',
  sms: 'twilio',
}

export function listAvailableProviders(): ProviderName[] {
  return Object.keys(PROVIDER_FACTORIES) as ProviderName[]
}

export function getProviderForChannel(channel: ChannelType): ProviderName {
  return CHANNEL_DEFAULT_PROVIDER[channel]
}

// ============ Instance Cache (per project+provider) ============

const instanceCache = new Map<string, Provider>() // key: `${projectId}:${providerName}`
const instanceCacheLock = new Map<string, Promise<Provider>>()

export async function getProviderInstance(projectId: string, providerName: ProviderName): Promise<Provider> {
  const cacheKey = `${projectId}:${providerName}`

  // Quick path
  const cached = instanceCache.get(cacheKey)
  if (cached) return cached

  // Serialize initialization per cache key
  const existing = instanceCacheLock.get(cacheKey)
  if (existing) return existing

  const promise = (async () => {
    // Load provider config from DB
    const config = await db.providerConfig.findFirst({
      where: { projectId, name: providerName, enabled: true },
    })

    if (!config) {
      throw new Error(`Provider "${providerName}" is not configured for project ${projectId}`)
    }

    const factory = PROVIDER_FACTORIES[providerName]
    const instance = factory()
    const credentials = JSON.parse(config.credentials || '{}')
    const cfg = JSON.parse(config.config || '{}')
    await instance.initialize(credentials, cfg)
    instanceCache.set(cacheKey, instance)
    instanceCacheLock.delete(cacheKey)
    return instance
  })()

  instanceCacheLock.set(cacheKey, promise)
  return promise
}

export async function getProviderForChannelForProject(
  projectId: string,
  channel: ChannelType,
  preferredProvider?: ProviderName
): Promise<Provider> {
  const providerName = preferredProvider || getProviderForChannel(channel)
  return getProviderInstance(projectId, providerName)
}

export function invalidateProviderCache(projectId: string, providerName?: ProviderName) {
  if (providerName) {
    instanceCache.delete(`${projectId}:${providerName}`)
  } else {
    for (const key of [...instanceCache.keys()]) {
      if (key.startsWith(`${projectId}:`)) instanceCache.delete(key)
    }
  }
}

// ============ Health Check All ============

export async function healthCheckAllProviders(projectId: string): Promise<Array<{ name: ProviderName; healthy: boolean; latencyMs: number; details?: string }>> {
  const configs = await db.providerConfig.findMany({
    where: { projectId, enabled: true },
    select: { name: true },
  })
  const results: Array<{ name: ProviderName; healthy: boolean; latencyMs: number; details?: string }> = []
  for (const { name } of configs) {
    try {
      const instance = await getProviderInstance(projectId, name as ProviderName)
      const res = await instance.healthCheck()
      results.push({ name: name as ProviderName, ...res })
    } catch (e) {
      results.push({ name: name as ProviderName, healthy: false, latencyMs: 0, details: (e as Error).message })
    }
  }
  return results
}
