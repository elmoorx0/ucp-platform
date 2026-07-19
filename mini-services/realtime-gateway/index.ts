/**
 * UCP Realtime Gateway
 * ---------------------
 * Standalone Socket.io service on port 3003.
 *
 * Responsibilities:
 *  - Authenticate socket connections via API key (query DB via bun:sqlite)
 *  - Manage channel subscriptions (per project)
 *  - Track user presence (in-memory; Redis in production)
 *  - Poll DB for new in-app notifications & deliver them to connected sockets
 *  - Forward realtime messages between connected clients
 *
 * Connection protocol:
 *  Client connects with: io('/?XTransformPort=3003', { auth: { apiKey, userId } })
 *  After auth, client may subscribe to channels via 'channel:subscribe' event.
 */

import { createServer, IncomingMessage } from 'http'
import { Server, Socket } from 'socket.io'
import { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'

// ============ Config ============

const PORT = 3003
const DB_PATH = (process.env.DATABASE_URL?.replace(/^file:/, '') || '/home/z/my-project/db/custom.db').replace(/^file:/, '')
if (!existsSync(DB_PATH)) {
  console.error(`[Gateway] DB not found at ${DB_PATH}`)
  process.exit(1)
}

// ============ Database ============

const sqlite = new Database(DB_PATH)
sqlite.exec('PRAGMA journal_mode = WAL;')
sqlite.exec('PRAGMA foreign_keys = ON;')

interface ApiKeyRow {
  id: string
  projectId: string
  hashedKey: string
  keyPrefix: string
  scopes: string
  status: string
  expiresAt: string | null
}

function verifyApiKey(rawKey: string): { apiKeyId: string; projectId: string; projectName: string; scopes: string[] } | null {
  const prefix = rawKey.substring(0, 16)
  const stmt = sqlite.prepare(`
    SELECT ak.id, ak.projectId, ak.hashedKey, ak.scopes, ak.status, ak.expiresAt, p.name as projectName, p.status as projectStatus
    FROM ApiKey ak
    JOIN Project p ON p.id = ak.projectId
    WHERE ak.keyPrefix = ? AND ak.status = 'active'
  `)
  const rows = stmt.all(prefix) as (ApiKeyRow & { projectName: string; projectStatus: string })[]
  for (const row of rows) {
    if (row.projectStatus !== 'active') continue
    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) continue
    if (verifyKeyHash(rawKey, row.hashedKey)) {
      return {
        apiKeyId: row.id,
        projectId: row.projectId,
        projectName: row.projectName,
        scopes: JSON.parse(row.scopes || '[]'),
      }
    }
  }
  return null
}

function verifyKeyHash(plaintext: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const secret = process.env.API_KEY_HASH_SECRET || 'ucp-default-secret-change-in-prod'
  const test = Bun.crypto.scryptHashSync(plaintext, `${secret}:${salt}`, 64)
  const testHex = Buffer.from(test).toString('hex')
  if (testHex.length !== hash.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) {
    diff |= testHex.charCodeAt(i) ^ hash.charCodeAt(i)
  }
  return diff === 0
}

function logAudit(projectId: string, action: string, payload: unknown, channel?: string) {
  try {
    sqlite.prepare(`
      INSERT INTO Event (id, projectId, type, source, payload, channel, delivered, createdAt)
      VALUES (?, ?, ?, 'realtime', ?, ?, 1, datetime('now'))
    `).run(randomUUID(), projectId, action, JSON.stringify(payload), channel || `realtime:${projectId}`)
  } catch (e) {
    console.error('[Gateway] failed to log event:', e)
  }
}

// ============ Presence ============

interface PresenceEntry {
  userId: string
  projectId: string
  socketIds: Set<string>
  status: 'online' | 'away' | 'offline'
  lastSeenAt: number
  metadata: Record<string, unknown>
}

const presence = new Map<string, PresenceEntry>()

function presenceKey(projectId: string, userId: string) {
  return `${projectId}:${userId}`
}

function setOnline(projectId: string, userId: string, socketId: string, metadata: Record<string, unknown> = {}) {
  const k = presenceKey(projectId, userId)
  let entry = presence.get(k)
  if (!entry) {
    entry = {
      userId,
      projectId,
      socketIds: new Set(),
      status: 'online',
      lastSeenAt: Date.now(),
      metadata,
    }
    presence.set(k, entry)
  }
  entry.socketIds.add(socketId)
  entry.status = 'online'
  entry.lastSeenAt = Date.now()
  entry.metadata = { ...entry.metadata, ...metadata }
}

function setOffline(projectId: string, userId: string, socketId: string) {
  const k = presenceKey(projectId, userId)
  const entry = presence.get(k)
  if (!entry) return false
  entry.socketIds.delete(socketId)
  if (entry.socketIds.size === 0) {
    presence.delete(k)
    return true
  }
  return false
}

function getOnlineUsers(projectId: string): PresenceEntry[] {
  const out: PresenceEntry[] = []
  for (const e of presence.values()) {
    if (e.projectId === projectId && e.status !== 'offline') {
      out.push({ ...e, socketIds: new Set() })
    }
  }
  return out
}

// ============ HTTP Server (for stats only — Socket.io intercepts other paths) ============

const httpServer = createServer((req: IncomingMessage, res) => {
  // Socket.io intercepts most paths; we just respond to /healthz and /stats with port-aware routing
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    service: 'ucp-realtime-gateway',
    port: PORT,
    uptime: process.uptime(),
    socketCount: io.engine.clientsCount,
    presenceCount: presence.size,
    note: 'Use Socket.io client to connect. Stats available via Socket.io events.',
  }))
})

// ============ Socket.io Server ============

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
})

interface ClientData {
  apiKeyId?: string
  projectId?: string
  userId?: string
  authenticated: boolean
  channels: Set<string>
}

io.use((socket: Socket, next) => {
  const apiKey = (socket.handshake.auth as { apiKey?: string } | undefined)?.apiKey || (socket.handshake.query.apiKey as string | undefined)
  const userId = (socket.handshake.auth as { userId?: string } | undefined)?.userId || (socket.handshake.query.userId as string | undefined)
  if (!apiKey || typeof apiKey !== 'string') {
    return next(new Error('Missing apiKey'))
  }
  if (!userId || typeof userId !== 'string') {
    return next(new Error('Missing userId'))
  }
  const ctx = verifyApiKey(apiKey)
  if (!ctx) {
    return next(new Error('Invalid apiKey'))
  }
  socket.data = {
    apiKeyId: ctx.apiKeyId,
    projectId: ctx.projectId,
    userId,
    authenticated: true,
    channels: new Set<string>(),
  } as ClientData
  next()
})

io.on('connection', (socket: Socket) => {
  const data = socket.data as ClientData
  const { projectId, userId } = data
  if (!projectId || !userId) {
    socket.disconnect(true)
    return
  }

  console.log(`[Gateway] connected socket=${socket.id} project=${projectId} user=${userId}`)

  setOnline(projectId, userId, socket.id, { connectedAt: Date.now() })
  io.to(`proj:${projectId}:presence`).emit('presence:update', {
    userId,
    status: 'online',
    lastSeenAt: Date.now(),
  })

  socket.join(`proj:${projectId}`)
  socket.join(`proj:${projectId}:user:user:${userId}`)

  // ============ Channel Subscription ============

  socket.on('channel:subscribe', (channel: unknown, ack?: (res: unknown) => void) => {
    if (typeof channel !== 'string' || channel.length === 0 || channel.length > 200) {
      ack?.({ ok: false, error: 'Invalid channel name' })
      return
    }
    const room = `proj:${projectId}:chan:${channel}`
    socket.join(room)
    data.channels.add(channel)
    io.to(`proj:${projectId}:presence`).emit('channel:subscribed', { channel, userId })
    ack?.({ ok: true, channel })
  })

  socket.on('channel:unsubscribe', (channel: unknown, ack?: (res: unknown) => void) => {
    if (typeof channel !== 'string') {
      ack?.({ ok: false, error: 'Invalid channel' })
      return
    }
    const room = `proj:${projectId}:chan:${channel}`
    socket.leave(room)
    data.channels.delete(channel)
    ack?.({ ok: true, channel })
  })

  // ============ Message Broadcasting ============

  socket.on('message', (msg: unknown, ack?: (res: unknown) => void) => {
    const m = msg as { channel?: string; event: string; payload: unknown; targetUserId?: string } | null
    if (!m || typeof m.event !== 'string') {
      ack?.({ ok: false, error: 'Invalid message format' })
      return
    }
    const wrappedPayload = {
      ...(typeof m.payload === 'object' && m.payload ? m.payload : { value: m.payload }),
      __meta: { fromUserId: userId, projectId, timestamp: Date.now() },
    }

    let recipients = 0
    if (m.targetUserId) {
      recipients = io.to(`proj:${projectId}:user:user:${m.targetUserId}`).emit(m.event, wrappedPayload)
    } else if (m.channel) {
      recipients = io.to(`proj:${projectId}:chan:${m.channel}`).emit(m.event, wrappedPayload)
    } else {
      recipients = io.to(`proj:${projectId}`).emit(m.event, wrappedPayload)
    }

    logAudit(projectId, 'realtime.message', { event: m.event, channel: m.channel, fromUserId: userId, recipients })
    ack?.({ ok: true, recipients })
  })

  // ============ Presence Queries ============

  socket.on('presence:get-online', (_data: unknown, ack?: (res: unknown) => void) => {
    ack?.({ users: getOnlineUsers(projectId) })
  })

  socket.on('presence:watch', () => {
    socket.join(`proj:${projectId}:presence`)
  })

  socket.on('presence:unwatch', () => {
    socket.leave(`proj:${projectId}:presence`)
  })

  // ============ Heartbeat ============

  socket.on('activity', () => {
    const k = presenceKey(projectId, userId)
    const entry = presence.get(k)
    if (entry && entry.status === 'away') {
      entry.status = 'online'
      entry.lastSeenAt = Date.now()
      io.to(`proj:${projectId}:presence`).emit('presence:update', {
        userId,
        status: 'online',
        lastSeenAt: entry.lastSeenAt,
      })
    }
  })

  // ============ Disconnect ============

  socket.on('disconnect', (reason) => {
    const wentOffline = setOffline(projectId, userId, socket.id)
    if (wentOffline) {
      io.to(`proj:${projectId}:presence`).emit('presence:update', {
        userId,
        status: 'offline',
        lastSeenAt: Date.now(),
      })
    }
    console.log(`[Gateway] disconnected socket=${socket.id} reason=${reason} wentOffline=${wentOffline}`)
  })

  socket.on('error', (err) => {
    console.error(`[Gateway] socket error socket=${socket.id}:`, err)
  })
})

// ============ Notification Poller ============
// Polls DB for new in-app notifications and emits them to connected sockets.

let lastPollAt = new Date(0)
const POLL_INTERVAL_MS = 500

async function pollForInAppNotifications() {
  try {
    // Find in-app notifications created since last poll that have at least one pending target
    const stmt = sqlite.prepare(`
      SELECT DISTINCT n.id, n.projectId, n.title, n.body, n.imageUrl, n.data, n.createdAt
      FROM Notification n
      INNER JOIN NotificationTarget nt ON nt.notificationId = n.id
      WHERE (n.channel = 'inapp' OR n.channel = 'multi')
        AND nt.channel = 'inapp'
        AND nt.status = 'pending'
        AND n.createdAt > ?
      ORDER BY n.createdAt ASC
      LIMIT 100
    `)
    const notifications = stmt.all(lastPollAt.toISOString()) as Array<{
      id: string
      projectId: string
      title: string
      body: string
      imageUrl: string | null
      data: string
      createdAt: string
    }>

    for (const n of notifications) {
      // Get targets
      const targetsStmt = sqlite.prepare(`
        SELECT nt.id, nt.endUserId, eu.externalId
        FROM NotificationTarget nt
        LEFT JOIN EndUser eu ON eu.id = nt.endUserId
        WHERE nt.notificationId = ? AND nt.channel = 'inapp' AND nt.status = 'pending'
      `)
      const targets = targetsStmt.all(n.id) as Array<{ id: string; endUserId: string | null; externalId: string | null }>

      const payload = {
        notificationId: n.id,
        title: n.title,
        body: n.body,
        imageUrl: n.imageUrl,
        data: JSON.parse(n.data || '{}'),
        timestamp: new Date(n.createdAt).getTime(),
      }

      let delivered = 0
      const targetIds: string[] = []
      for (const t of targets) {
        if (!t.endUserId) continue
        targetIds.push(t.id)
        // Emit to user's personal room
        io.to(`proj:${n.projectId}:user:user:${t.endUserId}`).emit('inapp:notification', payload)
        delivered++
      }

      // Mark targets as sent
      if (targetIds.length > 0) {
        const placeholders = targetIds.map(() => '?').join(',')
        sqlite.prepare(`UPDATE NotificationTarget SET status = 'sent', deliveredAt = datetime('now') WHERE id IN (${placeholders})`).run(...targetIds)
      }

      if (delivered > 0) {
        logAudit(n.projectId, 'inapp.delivered', { notificationId: n.id, recipients: delivered }, `inapp:${n.projectId}`)
        console.log(`[Gateway] delivered in-app notification ${n.id} to ${delivered} recipients`)
      }
    }

    lastPollAt = new Date()
  } catch (e) {
    console.error('[Gateway] poll error:', e)
  }
}

setInterval(pollForInAppNotifications, POLL_INTERVAL_MS)

// ============ Stats Logger ============

setInterval(() => {
  if (io.engine.clientsCount > 0) {
    console.log(`[Gateway] stats: sockets=${io.engine.clientsCount} presence=${presence.size}`)
  }
}, 30000)

// ============ Graceful Shutdown ============

process.on('SIGTERM', () => {
  console.log('[Gateway] SIGTERM received, shutting down...')
  io.close(() => {
    httpServer.close(() => {
      sqlite.close()
      process.exit(0)
    })
  })
})

process.on('SIGINT', () => {
  console.log('[Gateway] SIGINT received, shutting down...')
  io.close(() => {
    httpServer.close(() => {
      sqlite.close()
      process.exit(0)
    })
  })
})

httpServer.listen(PORT, () => {
  console.log(`[Gateway] UCP Realtime Gateway listening on port ${PORT}`)
  console.log(`[Gateway] Database: ${DB_PATH}`)
  console.log(`[Gateway] In-app notification poller running every ${POLL_INTERVAL_MS}ms`)
})
