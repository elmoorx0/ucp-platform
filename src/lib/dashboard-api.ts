/**
 * API client for the dashboard
 */

import type { ApiResponse } from '@/lib/types'

export interface NotificationItem {
  id: string; channel: string; title: string; body: string; status: string;
  totalTargets: number; deliveredCount: number; failedCount: number; pendingCount: number;
  createdAt: string; sentAt: string | null
}

async function parseJsonSafe(res: Response): Promise<ApiResponse> {
  try {
    const text = await res.text()
    if (!text) {
      return { success: false, error: { code: 'EMPTY_RESPONSE', message: 'Server returned empty response' } }
    }
    return JSON.parse(text) as ApiResponse
  } catch (e) {
    return { success: false, error: { code: 'PARSE_ERROR', message: `Failed to parse response: ${(e as Error).message}` } }
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
    })
  } catch (e) {
    throw new Error(`Network error: ${(e as Error).message}`)
  }

  if (!res.ok && res.status !== 400 && res.status !== 401 && res.status !== 403 && res.status !== 404) {
    // For 5xx errors, try to get the body but don't fail on parse
    const text = await res.text().catch(() => '')
    throw new Error(`Server error ${res.status}: ${text || res.statusText}`)
  }

  const json = await parseJsonSafe(res)
  if (!json.success) {
    throw new Error(json.error?.message || 'API request failed')
  }
  return json.data as T
}

// Helper for paginated endpoints that return data + meta
async function apiFetchPaginated<T>(path: string): Promise<{ items: T[]; total: number; totalPages: number }> {
  let res: Response
  try {
    res = await fetch(path, { credentials: 'include' })
  } catch (e) {
    throw new Error(`Network error: ${(e as Error).message}`)
  }

  const json = await parseJsonSafe(res) as ApiResponse<T[]>
  if (!json.success) throw new Error(json.error?.message || 'API request failed')
  return {
    items: (json.data as T[]) || [],
    total: json.meta?.total || 0,
    totalPages: json.meta?.totalPages || 0,
  }
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    return apiFetch<{ user: { id: string; email: string; name?: string; role: string; tenantId?: string } }>(
      '/api/dashboard/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    )
  },
  async register(email: string, password: string, name?: string, tenantName?: string) {
    return apiFetch<{ user: { id: string; email: string; role: string }; isFirstUser: boolean }>(
      '/api/dashboard/register',
      { method: 'POST', body: JSON.stringify({ email, password, name, tenantName }) }
    )
  },
  async logout() {
    return fetch('/api/dashboard/login', { method: 'DELETE' })
  },
  async me() {
    return apiFetch<{ userId: string; email: string; name?: string; role: string; tenantId?: string }>('/api/dashboard/me')
  },

  // Projects
  async listProjects() {
    return apiFetch<Array<{ id: string; name: string; slug: string; description?: string | null; status: string; createdAt: string; _count?: { apiKeys: number; endUsers: number; devices: number; notifications: number } }>>('/api/dashboard/projects')
  },
  async createProject(name: string, description?: string) {
    return apiFetch<{ id: string; name: string; slug: string }>('/api/dashboard/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
  },

  // API Keys
  async listApiKeys(projectId: string) {
    return apiFetch<Array<{
      id: string; name: string; keyPrefix: string; scopes: string; permissions: string;
      rateLimitPerMin: number; lastUsedAt: string | null; lastUsedIp: string | null;
      expiresAt: string | null; status: string; createdAt: string
    }>>(`/api/dashboard/api-keys?projectId=${projectId}`)
  },
  async createApiKey(projectId: string, name: string, scopes?: string[], rateLimitPerMin?: number) {
    return apiFetch<{ id: string; name: string; keyPrefix: string; plaintext: string; scopes: string[]; rateLimitPerMin: number; createdAt: string }>(
      '/api/dashboard/api-keys',
      { method: 'POST', body: JSON.stringify({ projectId, name, scopes, rateLimitPerMin }) }
    )
  },
  async revokeApiKey(projectId: string, apiKeyId: string) {
    return apiFetch<{ revoked: boolean; id: string }>(`/api/dashboard/api-keys/${apiKeyId}/revoke?projectId=${projectId}`, { method: 'POST' })
  },

  // Notifications
  async listNotifications(projectId: string, page = 1, status?: string) {
    let url = `/api/dashboard/notifications?projectId=${projectId}&page=${page}&pageSize=20`
    if (status) url += `&status=${status}`
    return apiFetchPaginated<NotificationItem>(url)
  },
  async getNotification(projectId: string, id: string) {
    return apiFetch<{
      id: string; status: string; totalTargets: number; delivered: number; failed: number; pending: number;
      targets?: Array<{ id: string; endUserId?: string; deviceId?: string; channel: string; status: string; error?: string; providerMessageId?: string }>
    }>(`/api/dashboard/notifications/${id}?projectId=${projectId}`)
  },
  async sendNotification(projectId: string, body: Record<string, unknown>) {
    return apiFetch<unknown>('/api/dashboard/notifications', {
      method: 'POST',
      body: JSON.stringify({ projectId, ...body }),
    })
  },
  async cancelNotification(projectId: string, id: string) {
    return apiFetch<unknown>(`/api/dashboard/notifications/${id}?projectId=${projectId}`, { method: 'DELETE' })
  },

  // Providers
  async listProviders(projectId: string) {
    return apiFetch<Array<{
      name: string; displayName: string; configured: boolean; enabled: boolean; isDefault: boolean;
      credentials: Record<string, string> | null; config: Record<string, unknown> | null;
      health: { healthy: boolean; latencyMs: number; details?: string } | null
    }>>(`/api/dashboard/providers/${projectId}`)
  },
  async configureProvider(projectId: string, name: string, credentials: Record<string, unknown>, config?: Record<string, unknown>, enabled?: boolean) {
    return apiFetch<{ id: string; name: string; configured: boolean }>(`/api/dashboard/providers/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ name, credentials, config, enabled }),
    })
  },

  // Stats
  async getStats(projectId: string, days = 30) {
    return apiFetch<{
      notifStats: {
        total: number
        byStatus: Array<{ status: string; count: number }>
        byChannel: Array<{ channel: string; count: number }>
        recent: Array<{ status: string; channel: string; date: string }>
      }
      presenceStats: { onlineCount: number; awayCount: number }
      counts: { apiKeys: number; endUsers: number; devices: number; notifications: number; providers: number }
      project: { id: string; name: string; status: string } | null
    }>(`/api/dashboard/stats/${projectId}?days=${days}`)
  },

  // End Users
  async listEndUsers(projectId: string, page = 1) {
    return apiFetchPaginated<{
      id: string; externalId: string; email?: string | null; name?: string | null;
      language: string; tags: string; status: string; createdAt: string;
      _count?: { devices: number }
    }>(`/api/dashboard/endusers/${projectId}?page=${page}`)
  },

  // Events
  async listEvents(projectId: string, page = 1) {
    return apiFetchPaginated<{
      id: string; type: string; source: string; payload: string; channel?: string | null;
      delivered: boolean; createdAt: string
    }>(`/api/dashboard/events/${projectId}?page=${page}`)
  },

  // Audit Log
  async listAudit(page = 1) {
    return apiFetchPaginated<{
      id: string; action: string; resource?: string | null; resourceId?: string | null;
      ip?: string | null; userAgent?: string | null; status: string; message?: string | null;
      createdAt: string
    }>(`/api/dashboard/audit?page=${page}`)
  },

  // Seed
  async seed(force = false) {
    return apiFetch<{
      seeded: boolean
      tenant: { id: string; name: string }
      user: { email: string; password: string; role: string }
      project: { id: string; name: string; slug: string }
      apiKey: { plaintext?: string; note: string }
      sampleUsers: number
    }>(`/api/dashboard/seed${force ? '?force=true' : ''}`, { method: 'POST' })
  },

  // Health
  async health() {
    try {
      const res = await fetch('/api/health')
      if (!res.ok) {
        console.warn('[UCP] health check failed:', res.status, res.statusText)
        return { status: 'degraded', checks: { counts: { users: 0 } } }
      }
      const text = await res.text()
      if (!text) {
        console.warn('[UCP] health check returned empty response')
        return { status: 'degraded', checks: { counts: { users: 0 } } }
      }
      return JSON.parse(text)
    } catch (e) {
      console.warn('[UCP] health check error:', (e as Error).message)
      return { status: 'degraded', checks: { counts: { users: 0 } } }
    }
  },
}
