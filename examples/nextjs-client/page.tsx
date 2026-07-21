/**
 * Next.js Client Demo for UCP
 * =============================
 * Complete example showing how to integrate UCP into a Next.js application.
 *
 * This file demonstrates:
 *   1. Sending notifications via REST API
 *   2. Sending from templates
 *   3. Registering users and devices
 *   4. Connecting to the Realtime Gateway
 *   5. Receiving in-app notifications live
 *
 * Usage:
 *   1. Copy this file to your Next.js project as a page component
 *   2. Install the SDK: npm install ucp-platform-sdk socket.io-client
 *   3. Set environment variables (see below)
 *   4. Visit the page in your browser
 *
 * Environment variables needed:
 *   NEXT_PUBLIC_UCP_API_URL=https://your-app.vercel.app
 *   NEXT_PUBLIC_UCP_GATEWAY_URL=https://your-gateway.up.railway.app
 *   NEXT_PUBLIC_UCP_API_KEY=ucp_live_xxx  (or fetch from your backend)
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

// ============ Configuration ============

const UCP_API_URL = process.env.NEXT_PUBLIC_UCP_API_URL || 'http://localhost:3000'
const UCP_GATEWAY_URL = process.env.NEXT_PUBLIC_UCP_GATEWAY_URL || 'http://localhost:3003'

// In production, fetch this from your backend instead of exposing in the client
const UCP_API_KEY = process.env.NEXT_PUBLIC_UCP_API_KEY || 'ucp_live_xxx'

// ============ Types ============

interface Notification {
  id: string
  title: string
  body: string
  channel: string
  timestamp: number
}

interface User {
  externalId: string
  name: string
}

// ============ API Helper ============

async function ucpFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${UCP_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': UCP_API_KEY,
      ...options.headers,
    },
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message || 'API error')
  return json.data
}

// ============ Main Component ============

export default function UCPDemo() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userId, setUserId] = useState('demo-user-001')
  const [userName, setUserName] = useState('Demo User')
  const [channel, setChannel] = useState('demo-channel')
  const [message, setMessage] = useState('Hello from UCP demo!')
  const [log, setLog] = useState<string[]>([])

  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  // ============ Connect to Realtime Gateway ============

  const connect = () => {
    if (!userId) {
      addLog('error: User ID is required')
      return
    }

    addLog(`Connecting to gateway as ${userId}...`)

    const s = io(UCP_GATEWAY_URL, {
      auth: { apiKey: UCP_API_KEY, userId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    })

    s.on('connect', () => {
      setConnected(true)
      addLog(`✓ Connected (socket ID: ${s.id})`)

      // Subscribe to a channel
      s.emit('channel:subscribe', channel, (res: unknown) => {
        addLog(`✓ Subscribed to channel: ${channel}`)
      })

      // Watch presence updates
      s.emit('presence:watch')
    })

    s.on('disconnect', () => {
      setConnected(false)
      addLog('Disconnected from gateway')
    })

    s.on('connect_error', (err: Error) => {
      addLog(`✗ Connection error: ${err.message}`)
    })

    // Listen for in-app notifications
    s.on('inapp:notification', (data: { notificationId: string; title: string; body: string; timestamp: number }) => {
      addLog(`📩 Received in-app notification: ${data.title}`)
      setNotifications((prev) => [
        {
          id: data.notificationId,
          title: data.title,
          body: data.body,
          channel: 'inapp',
          timestamp: data.timestamp,
        },
        ...prev,
      ])
    })

    // Listen for channel messages
    s.on('message', (data: unknown) => {
      addLog(`💬 Channel message: ${JSON.stringify(data).slice(0, 100)}`)
    })

    // Listen for presence updates
    s.on('presence:update', (data: { userId: string; status: string }) => {
      addLog(`👁 ${data.userId} is now ${data.status}`)
    })

    setSocket(s)
  }

  const disconnect = () => {
    if (socket) {
      socket.disconnect()
      setSocket(null)
      setConnected(false)
      addLog('Disconnected')
    }
  }

  // ============ API Actions ============

  const registerUser = async () => {
    try {
      await ucpFetch('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          externalId: userId,
          name: userName,
          email: `${userId}@example.com`,
        }),
      })
      addLog(`✓ Registered user: ${userId}`)
    } catch (e) {
      addLog(`✗ Register user failed: ${(e as Error).message}`)
    }
  }

  const sendNotification = async () => {
    try {
      const result = await ucpFetch('/api/v1/notifications', {
        method: 'POST',
        body: JSON.stringify({
          channel: 'inapp',
          to: [userId],
          title: 'Test Notification',
          body: message,
          priority: 'normal',
        }),
      })
      addLog(`✓ Sent notification (ID: ${result.id}, targets: ${result.totalTargets})`)
    } catch (e) {
      addLog(`✗ Send failed: ${(e as Error).message}`)
    }
  }

  const sendTemplate = async (template: string, variables: Record<string, string>) => {
    try {
      const result = await ucpFetch('/api/v1/notifications/send-template', {
        method: 'POST',
        body: JSON.stringify({
          template,
          variables,
          locale: 'en',
          to: [userId],
          channel: 'inapp',
        }),
      })
      addLog(`✓ Sent template "${template}" (ID: ${result.id})`)
    } catch (e) {
      addLog(`✗ Template send failed: ${(e as Error).message}`)
    }
  }

  const broadcast = async () => {
    try {
      const result = await ucpFetch('/api/v1/realtime', {
        method: 'POST',
        body: JSON.stringify({
          channel,
          event: 'message',
          payload: { text: message, from: userName },
        }),
      })
      addLog(`✓ Broadcast to "${channel}" (${result.delivered} recipients)`)
    } catch (e) {
      addLog(`✗ Broadcast failed: ${(e as Error).message}`)
    }
  }

  const getPresence = async () => {
    try {
      const result = await ucpFetch('/api/v1/presence')
      addLog(`👁 Online users: ${result.users?.length || 0}`)
    } catch (e) {
      addLog(`✗ Presence failed: ${(e as Error).message}`)
    }
  }

  // ============ Helpers ============

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLog((prev) => [...prev, `[${timestamp}] ${msg}`].slice(-100))
  }

  // ============ Render ============

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">UCP Demo Client</h1>
        <p className="text-gray-600 mb-8">
          Complete example of integrating UCP into a Next.js app
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Controls */}
          <div className="space-y-4">
            {/* Connection */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                Realtime Connection
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">User ID</label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    disabled={connected}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">User Name</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div className="flex gap-2">
                  {!connected ? (
                    <button
                      onClick={connect}
                      className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                    >
                      Connect
                    </button>
                  ) : (
                    <button
                      onClick={disconnect}
                      className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700"
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    onClick={registerUser}
                    className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700"
                  >
                    Register User
                  </button>
                </div>
              </div>
            </div>

            {/* Send Notification */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Send Notification</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={sendNotification}
                    className="bg-green-600 text-white py-2 rounded hover:bg-green-700"
                  >
                    Send In-App
                  </button>
                  <button
                    onClick={() => sendTemplate('welcome', { name: userName, appName: 'UCP Demo' })}
                    className="bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
                  >
                    Send Welcome Template
                  </button>
                  <button
                    onClick={() => sendTemplate('otp', { code: String(Math.floor(100000 + Math.random() * 900000)) })}
                    className="bg-orange-600 text-white py-2 rounded hover:bg-orange-700"
                  >
                    Send OTP Template
                  </button>
                  <button
                    onClick={getPresence}
                    className="bg-gray-600 text-white py-2 rounded hover:bg-gray-700"
                  >
                    Get Presence
                  </button>
                </div>
              </div>
            </div>

            {/* Broadcast */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Broadcast to Channel</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Channel</label>
                  <input
                    type="text"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <button
                  onClick={broadcast}
                  className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
                >
                  Broadcast Message
                </button>
              </div>
            </div>
          </div>

          {/* Right column: Output */}
          <div className="space-y-4">
            {/* Received Notifications */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">
                Received Notifications ({notifications.length})
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-gray-400 text-sm">No notifications yet. Connect and send one!</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-3 bg-blue-50 rounded border-l-4 border-blue-500">
                      <div className="font-semibold">{n.title}</div>
                      <div className="text-sm text-gray-600">{n.body}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(n.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Log */}
            <div className="bg-gray-900 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4 text-green-400">Activity Log</h2>
              <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
                {log.length === 0 ? (
                  <p className="text-gray-500">No activity yet.</p>
                ) : (
                  log.map((line, i) => (
                    <div key={i} className="text-green-300">
                      {line}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
