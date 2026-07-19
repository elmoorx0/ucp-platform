/**
 * Core type definitions for UCP
 */

// ============ Provider Types ============

export type ChannelType = 'push' | 'email' | 'inapp' | 'webpush' | 'sms'
export type ProviderName = 'fcm' | 'email_smtp' | 'webpush' | 'inapp' | 'onesignal' | 'twilio'

export interface ProviderCapabilities {
  channels: ChannelType[]
  supportsBatch: boolean
  supportsTemplate: boolean
  supportsScheduled: boolean
  maxRatePerSecond: number
}

export interface SendRequest {
  /** Target recipient identifier(s) */
  to: string | string[]
  /** Notification title */
  title: string
  /** Notification body */
  body: string
  /** Image URL */
  imageUrl?: string
  /** Custom data payload */
  data?: Record<string, unknown>
  /** Specific device token (for push) */
  token?: string
  /** Web push subscription (for webpush) */
  subscription?: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
  /** Recipient email (for email) */
  email?: string
  /** Locale for i18n */
  locale?: string
}

export interface SendResult {
  success: boolean
  providerMessageId?: string
  error?: {
    code: string
    message: string
    retryable: boolean
  }
  metadata?: Record<string, unknown>
}

export interface Provider {
  readonly name: ProviderName
  readonly displayName: string
  readonly capabilities: ProviderCapabilities
  initialize(credentials: Record<string, unknown>, config?: Record<string, unknown>): Promise<void>
  validateCredentials(): Promise<boolean>
  send(request: SendRequest): Promise<SendResult>
  sendBatch?(requests: SendRequest[]): Promise<SendResult[]>
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; details?: string }>
  destroy?(): Promise<void>
}

// ============ Auth Context ============

export interface ApiKeyContext {
  apiKeyId: string
  projectId: string
  projectName: string
  scopes: string[]
  permissions: string[]
  rateLimitPerMin: number
  ip?: string
}

export interface DashboardUserContext {
  userId: string
  email: string
  name?: string
  role: string
  tenantId?: string
}

export type AuthContext = ApiKeyContext | DashboardUserContext

export function isApiKeyContext(ctx: AuthContext): ctx is ApiKeyContext {
  return (ctx as ApiKeyContext).apiKeyId !== undefined
}

// ============ Event Bus Types ============

export interface EventBusEvent<T = unknown> {
  id: string
  projectId: string
  type: string
  source: string
  payload: T
  channel?: string
  timestamp: number
}

export type EventHandler<T = unknown> = (event: EventBusEvent<T>) => void | Promise<void>

export interface Subscription {
  id: string
  unsubscribe: () => void
}

// ============ Presence Types ============

export interface PresenceState {
  userId: string
  projectId: string
  status: 'online' | 'away' | 'offline'
  socketId?: string
  lastSeenAt: number
  metadata?: Record<string, unknown>
}

// ============ Notification Types ============

export type NotificationStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'delivered'

export type TargetingType = 'user' | 'topic' | 'segment' | 'broadcast'

export interface NotificationInput {
  channel: ChannelType | 'multi'
  title: string
  body: string
  imageUrl?: string
  data?: Record<string, unknown>
  targetingType?: TargetingType
  targetingData?: {
    userIds?: string[]
    externalUserIds?: string[]
    topic?: string
    segment?: string
  }
  providerName?: ProviderName
  priority?: 'low' | 'normal' | 'high'
  scheduledAt?: Date
  externalId?: string
}

export interface NotificationResult {
  id: string
  status: NotificationStatus
  totalTargets: number
  delivered: number
  failed: number
  pending: number
  targets?: Array<{
    id: string
    endUserId?: string
    deviceId?: string
    channel: ChannelType
    status: string
    error?: string
    providerMessageId?: string
  }>
}

// ============ Realtime Types ============

export interface RealtimeMessage {
  projectId: string
  channel: string
  event: string
  payload: unknown
  senderId?: string
  timestamp: number
}

export interface ChannelSubscription {
  projectId: string
  channel: string
  socketId: string
  userId?: string
  subscribedAt: number
}

// ============ API Response ============

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    page?: number
    pageSize?: number
    total?: number
    requestId?: string
  }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    requestId?: string
  }
}
