/**
 * POST /api/dashboard/seed
 * Seeds demo data: tenant, project, super_admin user, API key, providers, sample notifications.
 * Idempotent — safe to call multiple times.
 */

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/crypto'
import { createApiKey, upsertProviderConfig } from '@/lib/services/identity'
import { ok, badRequest } from '@/lib/middleware/auth'

const SEED_EMAIL = 'admin@ucp.local'
const SEED_PASSWORD = 'ucp-admin-2026'

export async function POST(req: NextRequest) {
  // Allow forcing re-seed via ?force=true
  const force = req.nextUrl.searchParams.get('force') === 'true'

  // ============ 1. Tenant ============
  let tenant = await db.tenant.findUnique({ where: { slug: 'default' } })
  if (!tenant) {
    tenant = await db.tenant.create({
      data: { name: 'Default Organization', slug: 'default', plan: 'enterprise' },
    })
  }

  // ============ 2. Super Admin User ============
  let user = await db.user.findUnique({ where: { email: SEED_EMAIL } })
  if (!user) {
    user = await db.user.create({
      data: {
        email: SEED_EMAIL,
        passwordHash: hashPassword(SEED_PASSWORD),
        name: 'UCP Admin',
        role: 'super_admin',
        tenantId: tenant.id,
      },
    })
  } else if (force) {
    user = await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(SEED_PASSWORD), role: 'super_admin', tenantId: tenant.id, status: 'active' },
    })
  }

  // ============ 3. Demo Project ============
  let project = await db.project.findFirst({ where: { tenantId: tenant.id, slug: 'demo-app' } })
  if (!project) {
    project = await db.project.create({
      data: {
        tenantId: tenant.id,
        name: 'Demo Application',
        slug: 'demo-app',
        description: 'A demo project showcasing UCP capabilities',
      },
    })
  }

  // ============ 4. API Key ============
  // Find existing demo key
  let existingKeys = await db.apiKey.findMany({ where: { projectId: project.id, name: 'Demo API Key' } })
  let apiKeyPlaintext: string | null = null
  if (existingKeys.length === 0) {
    const created = await createApiKey({
      projectId: project.id,
      name: 'Demo API Key',
      scopes: ['*'],
      permissions: [],
      rateLimitPerMin: 10000,
    })
    apiKeyPlaintext = created.plaintext
  } else if (force) {
    // Revoke old, create new
    await db.apiKey.updateMany({ where: { projectId: project.id, name: 'Demo API Key' }, data: { status: 'revoked' } })
    const created = await createApiKey({
      projectId: project.id,
      name: 'Demo API Key',
      scopes: ['*'],
      permissions: [],
      rateLimitPerMin: 10000,
    })
    apiKeyPlaintext = created.plaintext
  }

  // ============ 5. Providers ============
  // FCM (simulated)
  await upsertProviderConfig({
    projectId: project.id,
    name: 'fcm',
    displayName: 'Firebase Cloud Messaging',
    credentials: { projectId: 'demo-project', clientEmail: 'firebase-adminsdk@demo.iam.gserviceaccount.com', privateKey: 'SIMULATED' },
    config: {},
    isDefault: true,
    enabled: true,
  })
  // Email (simulated)
  await upsertProviderConfig({
    projectId: project.id,
    name: 'email_smtp',
    displayName: 'Email (Mailtrap)',
    credentials: { host: 'smtp.mailtrap.io', port: 587, username: 'demo', password: 'demo' },
    config: { fromAddress: 'no-reply@ucp.local' },
    enabled: true,
  })
  // Web Push (simulated)
  await upsertProviderConfig({
    projectId: project.id,
    name: 'webpush',
    displayName: 'Web Push',
    credentials: { vapidSubject: 'mailto:admin@ucp.local', vapidPublicKey: 'SIMULATED', vapidPrivateKey: 'SIMULATED' },
    config: {},
    enabled: true,
  })
  // In-App (always works)
  await upsertProviderConfig({
    projectId: project.id,
    name: 'inapp',
    displayName: 'In-App Notifications',
    credentials: {},
    config: {},
    enabled: true,
  })

  // ============ 6. Sample End Users ============
  const sampleUsers = [
    { externalId: 'user-001', name: 'Alice Johnson', email: 'alice@example.com', tags: ['vip', 'beta'] },
    { externalId: 'user-002', name: 'Bob Smith', email: 'bob@example.com', tags: ['beta'] },
    { externalId: 'user-003', name: 'Carol Davis', email: 'carol@example.com', tags: [] },
    { externalId: 'user-004', name: 'David Wilson', email: 'david@example.com', tags: ['vip'] },
    { externalId: 'user-005', name: 'Eve Martinez', email: 'eve@example.com', tags: [] },
  ]
  for (const u of sampleUsers) {
    await db.endUser.upsert({
      where: { projectId_externalId: { projectId: project.id, externalId: u.externalId } },
      update: { name: u.name, email: u.email, tags: JSON.stringify(u.tags) },
      create: { projectId: project.id, ...u, tags: JSON.stringify(u.tags), attributes: '{}' },
    })
  }

  // ============ 7. Sample Notifications ============
  if (force) {
    await db.notification.deleteMany({ where: { projectId: project.id } })
  }
  const existingNotifs = await db.notification.count({ where: { projectId: project.id } })
  if (existingNotifs === 0) {
    const samples = [
      { channel: 'inapp', title: 'Welcome to UCP!', body: 'Your account is ready to use.', status: 'sent', deliveredCount: 5, failedCount: 0 },
      { channel: 'push', title: 'New message', body: 'You have a new message from Alice.', status: 'sent', deliveredCount: 3, failedCount: 0 },
      { channel: 'email', title: 'Weekly Summary', body: 'Here is your weekly activity report.', status: 'sent', deliveredCount: 5, failedCount: 0 },
      { channel: 'inapp', title: 'System Update', body: 'Scheduled maintenance tonight at 2 AM.', status: 'failed', deliveredCount: 0, failedCount: 2 },
      { channel: 'push', title: 'Order Shipped', body: 'Your order #1234 has been shipped.', status: 'sent', deliveredCount: 4, failedCount: 0 },
    ]
    for (const s of samples) {
      await db.notification.create({
        data: {
          projectId: project.id,
          channel: s.channel,
          title: s.title,
          body: s.body,
          status: s.status,
          totalTargets: s.deliveredCount + s.failedCount,
          deliveredCount: s.deliveredCount,
          failedCount: s.failedCount,
          pendingCount: 0,
          sentAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          data: '{}',
          targetingData: '{}',
          metadata: '{}',
        },
      })
    }
  }

  return ok({
    seeded: true,
    tenant: { id: tenant.id, name: tenant.name },
    user: { email: SEED_EMAIL, password: SEED_PASSWORD, role: user.role },
    project: { id: project.id, name: project.name, slug: project.slug },
    apiKey: apiKeyPlaintext ? { plaintext: apiKeyPlaintext, note: 'Save this key — it will not be shown again.' } : { note: 'Demo API Key already exists. Use ?force=true to regenerate.' },
    sampleUsers: sampleUsers.length,
  })
}
