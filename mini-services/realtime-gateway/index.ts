/**
 * UCP Realtime Gateway (Production-grade, Vercel-compatible deployment)
 * --------------------------------------------------------------------
 * Standalone Socket.io service for WebSocket connections.
 *
 * Database: SQLite (local dev) OR Turso libSQL (production on Vercel/Railway)
 *  - Both modes use the SAME libSQL client — only the DATABASE_URL format differs.
 *  - Local:    DATABASE_URL="file:./db/custom.db"
 *  - Turso:    DATABASE_URL="libsql://your-db.turso.io?authToken=xxx"
 *
 * Architecture (push-based, no polling):
 *  - Socket.io server for client WebSocket connections (port from $PORT or 3003)
 *  - Internal HTTP endpoint /internal/push for Next.js API to push messages INSTANTLY
 *  - Internal HTTP endpoint /internal/presence for Next.js API to query presence
 *  - All "in-app notification" delivery happens via direct push from Next.js API
 *    through this gateway (no DB polling).
 *
 * Auth:
 *  - Socket.io clients authenticate via API key (queried against DB)
 *  - Internal HTTP endpoints authenticate via Bearer INTERNAL_API_TOKEN
 *
 * Deployment:
 *  - Local dev:        bun index.ts (uses SQLite at DATABASE_URL=file:./db/custom.db)
 *  - Railway/Render:   Dockerfile (uses Turso libSQL at DATABASE_URL=libsql://...)
 *  - The $PORT env var is respected (Railway/Render auto-inject it)
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'
import { createClient, Client as LibSQLClient } from '@libsql/client'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ============ Config ============

const PORT = parseInt(process.env.PORT || '3003', 10)
const DB_URL = process.env.DATABASE_URL || 'file:./db/custom.db'
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'ucp-internal-dev-token-change-me'
const API_KEY_HASH_SECRET = process.env.API_KEY_HASH_SECRET || 'ucp-default-secret-change-in-prod'

const IS_TURSO = DB_URL.startsWith('libsql://') || DB_URL.startsWith('libsql:')
console.log(`[Gateway] Database: ${IS_TURSO ? 'Turso (libSQL)' : 'SQLite (local file)'}, port=${PORT}`)

// ============ Database (libSQL — works for both SQLite and Turso) ============

interface ApiKeyRow {
  id: string
  projectId: string
  hashedKey: string
  keyPrefix: string
  scopes: string
  status: string
  expiresAt: string | null
  projectName: string
  projectStatus: string
}

// Parse the connection URL
function getLibSQLConfig(): { url: string; authToken?: string } {
  if (IS_TURSO) {
    const urlMatch = DB_URL.match(/^(libsql:\/\/[^?]+)/)
    const authTokenMatch = DB_URL.match(/[?&]authToken=([^&]+)/)
    return {
      url: urlMatch ? urlMatch[1] : DB_URL,
      authToken: authTokenMatch ? decodeURIComponent(authTokenMatch[1]) : undefined,
    }
  }
  // Local SQLite file — ensure parent dir exists
  const __dirname = dirname(fileURLToPath(import.meta.url))
  let dbPath = DB_URL.replace(/^file:/, '')
  if (!dbPath.startsWith('/')) {
    dbPath = join(__dirname, dbPath.replace(/^\.\//, ''))
  }
  const parentDir = dirname(dbPath)
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }
  if (!existsSync(dbPath)) {
    console.warn(`[Gateway] SQLite DB not found at ${dbPath}.`)
    console.warn(`[Gateway] Run "bun run db:push" in the Next.js project first to create tables.`)
  }
  return { url: `file:${dbPath}` }
}

const libsql: LibSQLClient = createClient(getLibSQLConfig())

// Test connection
async function testConnection() {
  try {
    await libsql.execute('SELECT 1')
    console.log(`[Gateway] Database connected successfully`)
  } catch (e) {
    console.error(`[Gateway] Database connection failed:`, (e as Error).message)
    // Don't exit — let the gateway start; some endpoints may still work
  }
}

// ============ API Key Verification ============

function verifyKeyHash(plaintext: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = Bun.crypto.scryptHashSync(plaintext, `${API_KEY_HASH_SECRET}:${salt}`, 64)
  const testHex = Buffer.from(test).toString('hex')
  if (testHex.length !== hash.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) {
    diff |= testHex.charCodeAt(i) ^ hash.charCodeAt(i)
  }
  return diff === 0
}

async function verifyApiKey(rawKey: string): Promise<{ apiKeyId: string; projectId: string; projectName: string; scopes: string[] } | null> {
  const prefix = rawKey.substring(0, 16)
  try {
    const result = await libsql.execute({
      sql: `SELECT ak.id, ak.projectId, ak.hashedKey, ak.scopes, ak.status, ak.expiresAt,
                   p.name as projectName, p.status as projectStatus
            FROM ApiKey ak
            JOIN Project p ON p.id = ak.projectId
            WHERE ak.keyPrefix = ? AND ak.status = 'active'`,
      args: [prefix],
    })
    for (const row of result.rows as unknown as ApiKeyRow[]) {
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
  } catch (e) {
    console.error('[Gateway] verifyApiKey error:', (e as Error).message)
  }
  return null
}

async function logEvent(projectId: string, type: string, payload: unknown, channel?: string) {
  try {
    await libsql.execute({
      sql: `INSERT INTO Event (id, projectId, type, source, payload, channel, delivered, createdAt)
            VALUES (?, ?, ?, 'realtime', ?, ?, 1, ?)`,
      args: [
        randomUUID(),
        projectId,
        type,
        JSON.stringify(payload),
        channel || `realtime:${projectId}`,
        new Date().toISOString(),
      ],
    })
  } catch (e) {
    console.error('[Gateway] failed to log event:', (e as Error).message)
  }
}

// ============ Presence (in-memory; Redis adapter in production) ============

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
      userId, projectId, socketIds: new Set(),
      status: 'online', lastSeenAt: Date.now(), metadata,
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

function getUserStatus(projectId: string, userId: string): PresenceEntry | null {
  const entry = presence.get(presenceKey(projectId, userId))
  if (!entry) return null
  return { ...entry, socketIds: new Set() }
}

// ============ HTTP Server ============

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(json)
}

const httpServer = createServer()

// ============ HTTP request handler ============

const httpHandler = (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '/'
  const pathname = url.split('?')[0]
  const query = url.split('?')[1] || ''

  // Skip socket.io polling/websocket upgrade requests
  const isSocketIoReq = pathname === '/' && (query.includes('EIO=') || query.includes('transport=') || query.includes('sid='))
  if (isSocketIoReq) return

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end()
    return
  }

  // ============ Health Check ============
  if (pathname === '/health' && req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      service: 'ucp-realtime-gateway',
      version: '1.0.0',
      uptime: process.uptime(),
      socketCount: io.engine.clientsCount,
      presenceCount: presence.size,
      dbType: IS_TURSO ? 'turso' : 'sqlite',
      timestamp: Date.now(),
    })
  }

  // ============ Internal Push ============
  if (pathname === '/internal/push' && req.method === 'POST') {
    const auth = req.headers['authorization']
    if (auth !== `Bearer ${INTERNAL_API_TOKEN}`) {
      return sendJson(res, 401, { error: 'Unauthorized' })
    }
    const chunks: Buffer[] = []
    let bodyReceived = false
    let errored = false

    const processBody = () => {
      if (bodyReceived || errored) return
      bodyReceived = true
      const bodyText = Buffer.concat(chunks).toString()
      let body: {
        target: 'user' | 'channel' | 'project' | 'all' | 'socket'
        projectId?: string
        channel?: string
        userId?: string
        socketId?: string
        event: string
        payload: unknown
      } | null = null
      try { body = JSON.parse(bodyText || 'null') } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body' })
      }
      if (!body || typeof body.event !== 'string') {
        return sendJson(res, 400, { error: 'Invalid request body' })
      }

      let recipients = 0
      const wrappedPayload = {
        ...(typeof body.payload === 'object' && body.payload !== null ? body.payload : { value: body.payload }),
        __meta: { source: 'server', timestamp: Date.now() },
      }

      switch (body.target) {
        case 'all':
          recipients = io.emit(body.event, wrappedPayload)
          break
        case 'project':
          if (!body.projectId) return sendJson(res, 400, { error: 'projectId is required for project target' })
          recipients = io.to(`proj:${body.projectId}`).emit(body.event, wrappedPayload)
          break
        case 'channel':
          if (!body.projectId || !body.channel) return sendJson(res, 400, { error: 'projectId and channel are required for channel target' })
          recipients = io.to(`proj:${body.projectId}:chan:${body.channel}`).emit(body.event, wrappedPayload)
          break
        case 'user':
          if (!body.projectId || !body.userId) return sendJson(res, 400, { error: 'projectId and userId are required for user target' })
          recipients = io.to(`proj:${body.projectId}:user:user:${body.userId}`).emit(body.event, wrappedPayload)
          break
        case 'socket':
          if (!body.socketId) return sendJson(res, 400, { error: 'socketId is required for socket target' })
          io.to(body.socketId).emit(body.event, wrappedPayload)
          recipients = 1
          break
        default:
          return sendJson(res, 400, { error: `Invalid target: ${body.target}` })
      }

      return sendJson(res, 200, { ok: true, recipients, event: body.event })
    }

    req.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    req.on('end', () => { processBody() })
    req.on('error', () => {
      if (!errored && !bodyReceived) {
        errored = true
        if (!res.writableEnded) sendJson(res, 400, { error: 'Read error' })
      }
    })
    req.resume()
    return
  }

  // ============ Internal Presence ============
  if (pathname === '/internal/presence' && req.method === 'GET') {
    const auth = req.headers['authorization']
    if (auth !== `Bearer ${INTERNAL_API_TOKEN}`) {
      return sendJson(res, 401, { error: 'Unauthorized' })
    }
    const urlObj = new URL(req.url || '', 'http://localhost')
    const projectId = urlObj.searchParams.get('projectId')
    const userId = urlObj.searchParams.get('userId')
    if (!projectId) return sendJson(res, 400, { error: 'projectId is required' })
    if (userId) {
      return sendJson(res, 200, { user: getUserStatus(projectId, userId) })
    }
    const users = getOnlineUsers(projectId)
    return sendJson(res, 200, { users, count: users.length })
  }

  // ============ Stats ============
  if (pathname === '/stats' && req.method === 'GET') {
    const projects = new Map<string, { sockets: number; users: number }>()
    for (const [, socket] of io.sockets.sockets) {
      const pid = (socket.data as { projectId?: string }).projectId
      if (!pid) continue
      const entry = projects.get(pid) || { sockets: 0, users: 0 }
      entry.sockets++
      projects.set(pid, entry)
    }
    for (const p of presence.values()) {
      const entry = projects.get(p.projectId) || { sockets: 0, users: 0 }
      entry.users++
      projects.set(p.projectId, entry)
    }
    return sendJson(res, 200, {
      uptime: process.uptime(),
      totalSockets: io.engine.clientsCount,
      totalPresence: presence.size,
      projects: Array.from(projects.entries()).map(([id, s]) => ({ projectId: id, ...s })),
    })
  }

  return sendJson(res, 404, { error: 'Not Found', path: pathname })
}

// ============ Socket.io Server ============

const io = new Server(httpServer, {
  path: '/',
  cors: false,
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
})

// HACK: Override Socket.io's "check" function. By default it matches ANY URL
// starting with '/' (since our path is '/'), which means it intercepts our
// /health, /internal/push etc. requests. We make it ONLY match URLs that look
// like Socket.io polling/websocket upgrade requests.
{
  const listeners = httpServer.listeners('request')
  for (let i = listeners.length - 1; i >= 0; i--) {
    const l = listeners[i]
    httpServer.removeListener('request', l)
    httpServer.on('request', (req, res) => {
      const url = req.url || '/'
      const query = url.split('?')[1] || ''
      const isSocketIoReq = (query.includes('EIO=') || query.includes('transport=') || query.includes('sid='))
      if (isSocketIoReq) {
        try { l.call(httpServer, req, res) } catch (e) { console.error('[Gateway] socket.io handler error:', e) }
      }
    })
  }
}

// Register our HTTP handler
httpServer.on('request', (req, res) => {
  const originalSetHeader = res.setHeader.bind(res)
  const originalWriteHead = res.writeHead.bind(res)
  const originalEnd = res.end.bind(res)
  const originalWrite = res.write.bind(res)

  res.setHeader = function (name: string, value: string | number | readonly string[]) {
    if (res.writableEnded || res.headersSent) return res
    try { return originalSetHeader(name, value) } catch { return res }
  } as typeof res.setHeader

  res.writeHead = function (...args: unknown[]) {
    if (res.writableEnded) return res
    try { return originalWriteHead(...args as []) } catch { return res }
  } as typeof res.writeHead

  res.end = function (...args: unknown[]) {
    if (res.writableEnded) return res
    try { return originalEnd(...args as []) } catch { return res }
  } as typeof res.end

  res.write = function (...args: unknown[]) {
    if (res.writableEnded) return false
    try { return originalWrite(...args as []) } catch { return false }
  } as typeof res.write

  try {
    httpHandler(req, res)
  } catch (err) {
    console.error('[Gateway] httpHandler error:', err)
    if (!res.writableEnded) {
      try { originalEnd.call(res, 'Internal Server Error') } catch {}
    }
  }
})

interface ClientData {
  apiKeyId?: string
  projectId?: string
  userId?: string
  authenticated: boolean
  channels: Set<string>
}

io.use(async (socket: Socket, next) => {
  const auth = socket.handshake.auth as { apiKey?: string; userId?: string } | undefined
  const query = socket.handshake.query as { apiKey?: string; userId?: string } | undefined
  const apiKey = auth?.apiKey || query?.apiKey
  const userId = auth?.userId || query?.userId
  if (!apiKey || typeof apiKey !== 'string') return next(new Error('Missing apiKey'))
  if (!userId || typeof userId !== 'string') return next(new Error('Missing userId'))
  const ctx = await verifyApiKey(apiKey)
  if (!ctx) return next(new Error('Invalid apiKey'))
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
    userId, status: 'online', lastSeenAt: Date.now(),
  })

  socket.join(`proj:${projectId}`)
  socket.join(`proj:${projectId}:user:user:${userId}`)
  socket.emit('connected', { socketId: socket.id, projectId, userId, serverTime: Date.now() })

  socket.on('channel:subscribe', (channel: unknown, ack?: (res: unknown) => void) => {
    if (typeof channel !== 'string' || channel.length === 0 || channel.length > 200) {
      ack?.({ ok: false, error: 'Invalid channel name' })
      return
    }
    socket.join(`proj:${projectId}:chan:${channel}`)
    data.channels.add(channel)
    io.to(`proj:${projectId}:presence`).emit('channel:subscribed', { channel, userId })
    ack?.({ ok: true, channel })
  })

  socket.on('channel:unsubscribe', (channel: unknown, ack?: (res: unknown) => void) => {
    if (typeof channel !== 'string') {
      ack?.({ ok: false, error: 'Invalid channel' })
      return
    }
    socket.leave(`proj:${projectId}:chan:${channel}`)
    data.channels.delete(channel)
    ack?.({ ok: true, channel })
  })

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
    logEvent(projectId, 'realtime.message', { event: m.event, channel: m.channel, fromUserId: userId, recipients })
    ack?.({ ok: true, recipients })
  })

  socket.on('presence:get-online', (_data: unknown, ack?: (res: unknown) => void) => {
    ack?.({ users: getOnlineUsers(projectId) })
  })

  socket.on('presence:get', (targetUserId: unknown, ack?: (res: unknown) => void) => {
    if (typeof targetUserId !== 'string') {
      ack?.({ ok: false, error: 'userId is required' })
      return
    }
    ack?.({ user: getUserStatus(projectId, targetUserId) })
  })

  socket.on('presence:watch', () => { socket.join(`proj:${projectId}:presence`) })
  socket.on('presence:unwatch', () => { socket.leave(`proj:${projectId}:presence`) })

  socket.on('activity', () => {
    const k = presenceKey(projectId, userId)
    const entry = presence.get(k)
    if (entry && entry.status === 'away') {
      entry.status = 'online'
      entry.lastSeenAt = Date.now()
      io.to(`proj:${projectId}:presence`).emit('presence:update', {
        userId, status: 'online', lastSeenAt: entry.lastSeenAt,
      })
    }
  })

  socket.on('disconnect', (reason) => {
    const wentOffline = setOffline(projectId, userId, socket.id)
    if (wentOffline) {
      io.to(`proj:${projectId}:presence`).emit('presence:update', {
        userId, status: 'offline', lastSeenAt: Date.now(),
      })
    }
    console.log(`[Gateway] disconnected socket=${socket.id} reason=${reason} wentOffline=${wentOffline}`)
  })

  socket.on('error', (err) => {
    console.error(`[Gateway] socket error socket=${socket.id}:`, err)
  })
})

// ============ Graceful Shutdown ============

async function shutdown() {
  console.log('[Gateway] Shutting down...')
  io.close()
  httpServer.close()
  libsql.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Start
testConnection().then(() => {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Gateway] UCP Realtime Gateway listening on port ${PORT}`)
    console.log(`[Gateway] Database: ${IS_TURSO ? 'Turso libSQL' : 'SQLite'} @ ${DB_URL.replace(/authToken=[^&]+/, 'authToken=***')}`)
    console.log(`[Gateway] Internal push endpoint: POST /internal/push (Bearer auth)`)
    console.log(`[Gateway] Internal presence endpoint: GET /internal/presence (Bearer auth)`)
    console.log(`[Gateway] NO POLLING — all delivery is push-based`)
  })
})
