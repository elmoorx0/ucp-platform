/**
 * Identity Service
 * - Tenant management
 * - User management (dashboard users)
 * - Project management
 * - API key management (CRUD + scopes/permissions)
 * - End-user management (recipients)
 * - Device registration
 */

import { db } from '@/lib/db'
import { generateApiKey, hashApiKey, hashPassword, verifyPassword, verifyApiKey } from '@/lib/crypto'
import type { ApiKeyContext, DashboardUserContext, ProviderName } from '@/lib/types'
import { getEventBus } from '@/lib/adapters'
import { invalidateProviderCache } from '@/lib/providers/registry'

// ============ Tenant ============

export async function createTenant(input: { name: string; slug?: string; plan?: string }) {
  const slug = input.slug || slugify(input.name)
  return db.tenant.create({
    data: { name: input.name, slug, plan: input.plan || 'free' },
  })
}

export async function getTenantBySlug(slug: string) {
  return db.tenant.findUnique({ where: { slug } })
}

// ============ Dashboard Users ============

export async function createDashboardUser(input: {
  email: string
  password: string
  name?: string
  role?: string
  tenantId?: string
}) {
  const passwordHash = hashPassword(input.password)
  const user = await db.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role || 'viewer',
      tenantId: input.tenantId,
    },
    select: { id: true, email: true, name: true, role: true, tenantId: true, createdAt: true },
  })
  await getEventBus().publish({
    projectId: '_platform',
    type: 'user.created',
    source: 'identity',
    payload: { userId: user.id, email: user.email, role: user.role },
  })
  return user
}

export async function authenticateDashboardUser(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } })
  if (!user || user.status !== 'active') return null
  if (!verifyPassword(password, user.passwordHash)) return null
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  return user
}

export async function listDashboardUsers(tenantId?: string) {
  return db.user.findMany({
    where: tenantId ? { tenantId } : undefined,
    select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true, tenantId: true },
    orderBy: { createdAt: 'desc' },
  })
}

// ============ Projects ============

export async function createProject(input: { tenantId: string; name: string; description?: string; slug?: string }) {
  const slug = input.slug || slugify(input.name)
  const project = await db.project.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      slug,
      description: input.description,
    },
  })
  await getEventBus().publish({
    projectId: project.id,
    type: 'project.created',
    source: 'identity',
    payload: { projectId: project.id, name: project.name },
  })
  return project
}

export async function listProjects(tenantId: string) {
  return db.project.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { apiKeys: true, endUsers: true, devices: true, notifications: true } } },
  })
}

export async function getProject(projectId: string) {
  return db.project.findUnique({ where: { id: projectId } })
}

// ============ API Keys ============

export interface CreateApiKeyInput {
  projectId: string
  name: string
  scopes?: string[]
  permissions?: string[]
  rateLimitPerMin?: number
  expiresAt?: Date
  test?: boolean
}

export interface CreatedApiKey {
  id: string
  name: string
  keyPrefix: string
  plaintext: string
  scopes: string[]
  permissions: string[]
  rateLimitPerMin: number
  expiresAt: Date | null
  createdAt: Date
}

export async function createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
  const { plaintext, hashedKey, keyPrefix } = generateApiKey(input.test || false)
  const row = await db.apiKey.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      keyPrefix,
      hashedKey,
      scopes: JSON.stringify(input.scopes || ['*']),
      permissions: JSON.stringify(input.permissions || []),
      rateLimitPerMin: input.rateLimitPerMin || 1000,
      expiresAt: input.expiresAt,
    },
  })
  await getEventBus().publish({
    projectId: input.projectId,
    type: 'apikey.created',
    source: 'identity',
    payload: { apiKeyId: row.id, name: row.name, keyPrefix },
  })
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    plaintext,
    scopes: input.scopes || ['*'],
    permissions: input.permissions || [],
    rateLimitPerMin: row.rateLimitPerMin,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  }
}

export async function listApiKeys(projectId: string) {
  return db.apiKey.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      permissions: true,
      rateLimitPerMin: true,
      lastUsedAt: true,
      lastUsedIp: true,
      expiresAt: true,
      status: true,
      createdAt: true,
    },
  })
}

export async function revokeApiKey(projectId: string, apiKeyId: string) {
  await db.apiKey.update({
    where: { id: apiKeyId, projectId },
    data: { status: 'revoked' },
  })
}

export async function verifyApiKeyFromRequest(rawKey: string, ip?: string): Promise<ApiKeyContext | null> {
  // Find by prefix — we store keyPrefix for lookup, then verify hash
  // For efficiency we scan keys with matching prefix
  // NOTE: In production with PostgreSQL, store an HMAC of the prefix as a separate indexed column.
  const prefix = rawKey.substring(0, 16)
  const candidates = await db.apiKey.findMany({
    where: { keyPrefix: prefix, status: 'active' },
    include: { project: { select: { id: true, name: true, status: true } } },
  })

  for (const candidate of candidates) {
    if (!verifyApiKey(rawKey, candidate.hashedKey)) continue
    if (candidate.project.status !== 'active') return null
    if (candidate.expiresAt && candidate.expiresAt < new Date()) return null

    // Update last used
    await db.apiKey.update({
      where: { id: candidate.id },
      data: { lastUsedAt: new Date(), lastUsedIp: ip },
    })

    return {
      apiKeyId: candidate.id,
      projectId: candidate.project.id,
      projectName: candidate.project.name,
      scopes: JSON.parse(candidate.scopes || '[]'),
      permissions: JSON.parse(candidate.permissions || '[]'),
      rateLimitPerMin: candidate.rateLimitPerMin,
      ip,
    }
  }
  return null
}

// ============ End Users ============

export async function registerEndUser(input: {
  projectId: string
  externalId: string
  email?: string
  phone?: string
  name?: string
  language?: string
  timezone?: string
  tags?: string[]
  attributes?: Record<string, unknown>
}) {
  return db.endUser.upsert({
    where: { projectId_externalId: { projectId: input.projectId, externalId: input.externalId } },
    update: {
      email: input.email,
      phone: input.phone,
      name: input.name,
      language: input.language || 'en',
      timezone: input.timezone || 'UTC',
      tags: JSON.stringify(input.tags || []),
      attributes: JSON.stringify(input.attributes || {}),
    },
    create: {
      projectId: input.projectId,
      externalId: input.externalId,
      email: input.email,
      phone: input.phone,
      name: input.name,
      language: input.language || 'en',
      timezone: input.timezone || 'UTC',
      tags: JSON.stringify(input.tags || []),
      attributes: JSON.stringify(input.attributes || {}),
    },
  })
}

export async function listEndUsers(projectId: string, page = 1, pageSize = 20) {
  const [total, items] = await Promise.all([
    db.endUser.count({ where: { projectId } }),
    db.endUser.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { devices: true } } },
    }),
  ])
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

// ============ Devices ============

export async function registerDevice(input: {
  projectId: string
  externalUserId: string
  token: string
  platform: string
  userAgent?: string
  appVersion?: string
  pushSubscription?: { endpoint: string; keys: { p256dh: string; auth: string } }
}) {
  // Ensure end-user exists
  const endUser = await registerEndUser({
    projectId: input.projectId,
    externalId: input.externalUserId,
  })

  // Upsert device by token
  const device = await db.device.upsert({
    where: { token: input.token },
    update: {
      endUserId: endUser.id,
      platform: input.platform,
      userAgent: input.userAgent,
      appVersion: input.appVersion,
      pushSubscription: input.pushSubscription ? JSON.stringify(input.pushSubscription) : undefined,
      status: 'active',
      lastSeenAt: new Date(),
    },
    create: {
      projectId: input.projectId,
      endUserId: endUser.id,
      token: input.token,
      platform: input.platform,
      userAgent: input.userAgent,
      appVersion: input.appVersion,
      pushSubscription: input.pushSubscription ? JSON.stringify(input.pushSubscription) : undefined,
      status: 'active',
      lastSeenAt: new Date(),
    },
  })

  await getEventBus().publish({
    projectId: input.projectId,
    type: 'device.registered',
    source: 'identity',
    payload: { deviceId: device.id, userId: endUser.id, platform: device.platform },
  })

  return device
}

export async function listDevices(projectId: string, page = 1, pageSize = 20) {
  const [total, items] = await Promise.all([
    db.device.count({ where: { projectId } }),
    db.device.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { endUser: { select: { externalId: true, name: true, email: true } } },
    }),
  ])
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

// ============ Provider Config ============

export async function upsertProviderConfig(input: {
  projectId: string
  name: ProviderName
  displayName?: string
  credentials: Record<string, unknown>
  config?: Record<string, unknown>
  isDefault?: boolean
  enabled?: boolean
}) {
  // If isDefault, unset other defaults of same project (only one default per channel group is fine; we keep simple)
  if (input.isDefault) {
    await db.providerConfig.updateMany({
      where: { projectId: input.projectId, isDefault: true },
      data: { isDefault: false },
    })
  }
  const row = await db.providerConfig.upsert({
    where: { projectId_name: { projectId: input.projectId, name: input.name } },
    update: {
      displayName: input.displayName,
      credentials: JSON.stringify(input.credentials),
      config: JSON.stringify(input.config || {}),
      isDefault: input.isDefault ?? false,
      enabled: input.enabled ?? true,
    },
    create: {
      projectId: input.projectId,
      name: input.name,
      displayName: input.displayName,
      credentials: JSON.stringify(input.credentials),
      config: JSON.stringify(input.config || {}),
      isDefault: input.isDefault ?? false,
      enabled: input.enabled ?? true,
    },
  })
  // Invalidate cache so next call re-reads credentials
  invalidateProviderCache(input.projectId, input.name)
  return row
}

export async function listProviderConfigs(projectId: string) {
  const rows = await db.providerConfig.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  })
  // Mask credentials before returning
  return rows.map((r) => ({
    ...r,
    credentials: maskCredentials(r.credentials),
    config: r.config,
  }))
}

function maskCredentials(credJson: string): Record<string, string> {
  try {
    const obj = JSON.parse(credJson) as Record<string, unknown>
    const masked: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        masked[k] = v.length > 8 ? `${v.substring(0, 4)}••••${v.substring(v.length - 4)}` : '••••'
      } else if (v !== null && v !== undefined) {
        masked[k] = '••••'
      }
    }
    return masked
  } catch {
    return {}
  }
}

// ============ Audit Log ============

export async function writeAuditLog(input: {
  tenantId?: string
  userId?: string
  apiKeyId?: string
  action: string
  resource?: string
  resourceId?: string
  before?: unknown
  after?: unknown
  ip?: string
  userAgent?: string
  status?: string
  message?: string
}) {
  return db.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      apiKeyId: input.apiKeyId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      before: input.before ? JSON.stringify(input.before) : undefined,
      after: input.after ? JSON.stringify(input.after) : undefined,
      ip: input.ip,
      userAgent: input.userAgent,
      status: input.status || 'success',
      message: input.message,
    },
  })
}

export async function listAuditLogs(filters: { tenantId?: string; userId?: string; action?: string }, page = 1, pageSize = 50) {
  const where: Record<string, unknown> = {}
  if (filters.tenantId) where.tenantId = filters.tenantId
  if (filters.userId) where.userId = filters.userId
  if (filters.action) where.action = { contains: filters.action }

  const [total, items] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

// ============ Helpers ============

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export type DashboardContext = DashboardUserContext
