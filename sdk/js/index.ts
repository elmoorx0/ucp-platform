/**
 * UCP JavaScript Client SDK
 * Universal Communication Platform — lightweight client for browser and Node.js.
 *
 * Installation:
 *   npm install ucp-platform-sdk
 *   # or
 *   bun add ucp-platform-sdk
 *
 * Or use directly via CDN:
 *   <script src="https://unpkg.com/ucp-platform-sdk@1/dist/index.umd.js"></script>
 *
 * Usage:
 *   import { UCP } from 'ucp-platform-sdk'
 *
 *   const ucp = new UCP({
 *     apiUrl: 'https://your-app.vercel.app',
 *     gatewayUrl: 'https://your-gateway.up.railway.app',
 *     apiKey: 'ucp_live_xxx',
 *   })
 *
 *   // Send a notification
 *   await ucp.notifications.send({
 *     channel: 'inapp',
 *     to: ['user-001'],
 *     title: 'Hello',
 *     body: 'World',
 *   })
 *
 *   // Send from template
 *   await ucp.notifications.sendTemplate('welcome', { name: 'Alice' }, {
 *     to: ['user-001'],
 *     locale: 'ar',
 *   })
 *
 *   // Register a device
 *   await ucp.devices.register({
 *     externalUserId: 'user-001',
 *     token: 'firebase-token',
 *     platform: 'android',
 *   })
 *
 *   // Connect to realtime
 *   const socket = ucp.realtime.connect('user-001')
 *   socket.on('inapp:notification', (data) => console.log('Got notif:', data))
 */

import { io, Socket } from 'socket.io-client'
import { createHmac } from 'crypto'

export interface UCPConfig {
  /** Base URL of the UCP Next.js API (e.g. https://your-app.vercel.app) */
  apiUrl: string
  /** URL of the UCP Realtime Gateway (e.g. https://your-gateway.up.railway.app) */
  gatewayUrl?: string
  /** API key (ucp_live_xxx) — required for all API calls */
  apiKey: string
  /** Default timeout for API requests (ms) — default: 30000 */
  timeout?: number
}

export interface SendNotificationOptions {
  channel: 'push' | 'email' | 'inapp' | 'webpush' | 'sms' | 'multi'
  to?: string | string[]
  title: string
  body: string
  imageUrl?: string
  data?: Record<string, unknown>
  targetingType?: 'user' | 'topic' | 'segment' | 'broadcast'
  targetingData?: { userIds?: string[]; externalUserIds?: string[]; topic?: string }
  priority?: 'low' | 'normal' | 'high'
  scheduledAt?: string
  externalId?: string
  projectId?: string
}

export interface SendTemplateOptions {
  to: string | string[]
  channel?: 'push' | 'email' | 'inapp' | 'webpush' | 'multi'
  locale?: string
  priority?: 'low' | 'normal' | 'high'
  projectId?: string
}

export interface RegisterDeviceOptions {
  externalUserId: string
  token: string
  platform: 'android' | 'ios' | 'web'
  userAgent?: string
  appVersion?: string
  pushSubscription?: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
}

export interface RegisterUserOptions {
  externalId: string
  email?: string
  phone?: string
  name?: string
  language?: string
  timezone?: string
  tags?: string[]
  attributes?: Record<string, unknown>
}

export interface UCPResponse<T = unknown> {
  success: boolean
  data?: T
  error?: { code: string; message: string; details?: unknown }
  meta?: { page?: number; pageSize?: number; total?: number; totalPages?: number; requestId?: string }
}

export class UCPError extends Error {
  code: string
  status: number
  details?: unknown

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message)
    this.name = 'UCPError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export class UCP {
  private config: Required<UCPConfig>

  constructor(config: UCPConfig) {
    this.config = {
      timeout: 30000,
      gatewayUrl: config.gatewayUrl || config.apiUrl,
      ...config,
    }
  }

  /**
   * Make an authenticated API request.
   */
  private async request<T = unknown>(
    path: string,
    options: { method?: string; body?: unknown; params?: Record<string, string | number | boolean | undefined> } = {}
  ): Promise<T> {
    const url = new URL(path, this.config.apiUrl)
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined) url.searchParams.set(k, String(v))
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const res = await fetch(url.toString(), {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })

      const json = (await res.json()) as UCPResponse<T>

      if (!json.success) {
        throw new UCPError(
          json.error?.message || 'Request failed',
          json.error?.code || 'UNKNOWN',
          res.status,
          json.error?.details
        )
      }

      return json.data as T
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Notifications API.
   */
  notifications = {
    /**
     * Send a notification.
     */
    send: (options: SendNotificationOptions) => {
      const body: Record<string, unknown> = { ...options }
      if (typeof body.to === 'string') body.to = [body.to]
      return this.request<{
        id: string
        status: string
        totalTargets: number
        delivered: number
        failed: number
        pending: number
      }>('/api/v1/notifications', { method: 'POST', body })
    },

    /**
     * Send a notification from a pre-defined template.
     */
    sendTemplate: (
      template: string,
      variables: Record<string, string | number | boolean> = {},
      options: SendTemplateOptions
    ) => {
      return this.request('/api/v1/notifications/send-template', {
        method: 'POST',
        body: {
          template,
          variables,
          to: typeof options.to === 'string' ? [options.to] : options.to,
          channel: options.channel || 'inapp',
          locale: options.locale || 'en',
          priority: options.priority,
          projectId: options.projectId,
        },
      })
    },

    /**
     * List notifications.
     */
    list: (params: { page?: number; pageSize?: number; status?: string; channel?: string } = {}) => {
      return this.request('/api/v1/notifications', { params })
    },

    /**
     * Get a single notification with delivery details.
     */
    get: (id: string) => {
      return this.request('/api/v1/notifications/' + encodeURIComponent(id))
    },

    /**
     * Cancel a pending notification.
     */
    cancel: (id: string) => {
      return this.request('/api/v1/notifications/' + encodeURIComponent(id) + '/cancel', { method: 'POST' })
    },
  }

  /**
   * Devices API.
   */
  devices = {
    /**
     * Register a device (FCM token, Web Push subscription, etc.).
     */
    register: (options: RegisterDeviceOptions) => {
      return this.request('/api/v1/devices', { method: 'POST', body: options })
    },

    /**
     * List registered devices.
     */
    list: (params: { page?: number; pageSize?: number } = {}) => {
      return this.request('/api/v1/devices', { params })
    },
  }

  /**
   * End Users API.
   */
  users = {
    /**
     * Register or update an end user.
     */
    register: (options: RegisterUserOptions) => {
      return this.request('/api/v1/users', { method: 'POST', body: options })
    },

    /**
     * List end users.
     */
    list: (params: { page?: number; pageSize?: number } = {}) => {
      return this.request('/api/v1/users', { params })
    },
  }

  /**
   * Templates API.
   */
  templates = {
    /**
     * List available notification templates.
     */
    list: () => {
      return this.request<Array<{ key: string; locales: string[]; description: string }>>('/api/v1/templates')
    },
  }

  /**
   * Realtime API (Socket.io).
   */
  realtime = {
    /**
     * Connect to the Realtime Gateway as a specific user.
     * Returns a Socket.io client.
     */
    connect: (userId: string, options: { transports?: ('websocket' | 'polling')[]; reconnection?: boolean } = {}): Socket => {
      if (!this.config.gatewayUrl) {
        throw new UCPError('gatewayUrl is required for realtime connections', 'CONFIG_ERROR', 0)
      }
      return io(this.config.gatewayUrl, {
        auth: { apiKey: this.config.apiKey, userId },
        transports: options.transports || ['websocket', 'polling'],
        reconnection: options.reconnection !== false,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })
    },
  }

  /**
   * Webhooks API.
   */
  webhooks = {
    /**
     * Test the project's webhook URL by sending a test event.
     */
    test: (event: 'notification.sent' | 'notification.delivered' | 'notification.failed' = 'notification.sent', projectId?: string) => {
      return this.request('/api/v1/webhooks/test', {
        method: 'POST',
        body: { event },
        params: projectId ? { projectId } : undefined,
      })
    },

    /**
     * Verify a webhook signature (for client use when receiving webhooks).
     */
    verifySignature: (payload: string, signature: string, secret: string): boolean => {
      const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
      if (expected.length !== signature.length) return false
      let diff = 0
      for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
      }
      return diff === 0
    },
  }

  /**
   * Stats API.
   */
  stats = {
    /**
     * Get notification statistics for the project.
     */
    get: (params: { days?: number; projectId?: string } = {}) => {
      return this.request('/api/v1/stats', { params })
    },
  }

  /**
   * Presence API.
   */
  presence = {
    /**
     * Get online users for the project.
     */
    getOnline: (projectId?: string) => {
      return this.request('/api/v1/presence', { params: projectId ? { projectId } : undefined })
    },

    /**
     * Get a specific user's presence status.
     */
    get: (userId: string, projectId?: string) => {
      return this.request('/api/v1/presence', { params: { userId, projectId } })
    },
  }

  /**
   * Health check (does not require authentication).
   */
  health(): Promise<unknown> {
    return fetch(this.config.apiUrl + '/api/health').then((r) => r.json())
  }
}

export default UCP
