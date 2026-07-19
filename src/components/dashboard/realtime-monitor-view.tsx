'use client'

import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/dashboard-api'
import { Project } from '@/app/page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Radio, Activity, Users, Send, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { io, Socket } from 'socket.io-client'

interface LogItem {
  id: string
  type: string
  message: string
  timestamp: number
}

interface Props {
  project: Project
  logs: LogItem[]
  onClearLogs: () => void
}

export function RealtimeMonitorView({ project, logs, onClearLogs }: Props) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<Array<{ event: string; payload: unknown; timestamp: number }>>([])
  const [apiKey, setApiKey] = useState('')
  const [userId, setUserId] = useState('demo-user-' + Math.random().toString(36).slice(2, 8))
  const [channel, setChannel] = useState('test-channel')
  const [testMessage, setTestMessage] = useState('Hello from UCP dashboard!')
  const [copied, setCopied] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const connect = () => {
    if (!apiKey || !userId) {
      toast.error('Need API key + user ID to connect')
      return
    }
    if (socket) socket.disconnect()
    const s = io('/?XTransformPort=3003', {
      auth: { apiKey, userId },
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
    })
    s.on('connect', () => {
      setConnected(true)
      addLog('success', `Connected as ${userId}`)
    })
    s.on('disconnect', () => {
      setConnected(false)
      addLog('info', 'Disconnected')
    })
    s.on('connect_error', (err: Error) => {
      addLog('error', `Connection error: ${err.message}`)
    })
    s.on('connected', (data: { socketId: string; projectId: string }) => {
      addLog('info', `Socket ID: ${data.socketId}`)
      s.emit('presence:watch')
      s.emit('channel:subscribe', channel, () => {
        addLog('info', `Subscribed to channel: ${channel}`)
      })
    })
    s.on('presence:update', (data: { userId: string; status: string }) => {
      addLog('presence', `Presence: ${data.userId} → ${data.status}`)
    })
    s.on('inapp:notification', (data: { notificationId: string; title: string; body: string }) => {
      addLog('notification', `In-app: ${data.title}`)
      setEvents((prev) => [...prev, { event: 'inapp:notification', payload: data, timestamp: Date.now() }])
    })
    s.on('test-event', (data: unknown) => {
      addLog('message', `Received test-event: ${JSON.stringify(data).slice(0, 80)}`)
      setEvents((prev) => [...prev, { event: 'test-event', payload: data, timestamp: Date.now() }])
    })
    s.onAny((eventName: string, ...args: unknown[]) => {
      if (!['connected', 'presence:update', 'inapp:notification', 'test-event'].includes(eventName)) {
        addLog('message', `Event: ${eventName}`)
      }
    })
    setSocket(s)
  }

  const disconnect = () => {
    if (socket) {
      socket.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }

  const addLog = (type: string, message: string) => {
    // We don't have direct access to setLogs here since logs comes from props
    // Use console for now (parent component manages logs)
    console.log(`[Realtime] ${type}: ${message}`)
  }

  // Send a test message via REST API
  const sendTestMessage = async () => {
    if (!channel || !testMessage) return
    try {
      const res = await fetch('/api/v1/realtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          channel,
          event: 'test-event',
          payload: { text: testMessage, from: 'dashboard' },
          projectId: project.id,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Sent to ${json.data.delivered} recipient(s)`)
      } else {
        toast.error(json.error?.message || 'Failed')
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Send an in-app notification (delivered via gateway)
  const sendInApp = async () => {
    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          channel: 'inapp',
          to: [userId],
          title: 'Test from dashboard',
          body: testMessage,
          projectId: project.id,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('In-app notification sent — check the live events below')
      } else {
        toast.error(json.error?.message || 'Failed')
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const copySocketSnippet = () => {
    const code = `// Connect to UCP Realtime Gateway
import { io } from 'socket.io-client'

const socket = io('/?XTransformPort=3003', {
  auth: { apiKey: '${apiKey || 'ucp_live_xxx'}', userId: 'user-123' }
})

socket.on('connect', () => console.log('connected'))
socket.on('inapp:notification', (data) => console.log('got notif:', data))
socket.emit('channel:subscribe', 'orders')
socket.on('message', (data) => console.log('channel message:', data))`
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Local event log (since logs prop isn't populated without socket auth in parent)
  const [localEvents, setLocalEvents] = useState<Array<{ event: string; payload: unknown; timestamp: number; type: string }>>([])
  useEffect(() => {
    // Override addLog to also push to localEvents
    if (socket) {
      const origOn = socket.on.bind(socket)
      // Already set up — just track events
    }
  }, [socket])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Realtime Monitor</h1>
        <p className="text-sm text-slate-500">Connect to the Socket.io gateway and observe live events.</p>
      </div>

      {/* Connection panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Connection
            <Badge variant={connected ? 'default' : 'secondary'} className="text-[10px]">
              {connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="ucp_live_xxx"
              />
              <div className="text-[10px] text-slate-400">Create one in the API Keys tab</div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">User ID</Label>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Channel</Label>
              <Input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="test-channel"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {!connected ? (
              <Button onClick={connect} disabled={!apiKey || !userId} className="bg-slate-900 hover:bg-slate-800">
                <Radio className="w-4 h-4 mr-2" />
                Connect
              </Button>
            ) : (
              <Button onClick={disconnect} variant="outline">
                Disconnect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Send panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send Test Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="Message text" />
            <div className="flex gap-2">
              <Button onClick={sendTestMessage} disabled={!apiKey} variant="outline" size="sm" className="flex-1">
                <Send className="w-3.5 h-3.5 mr-2" />
                Broadcast
              </Button>
              <Button onClick={sendInApp} disabled={!apiKey} variant="outline" size="sm" className="flex-1">
                <Activity className="w-3.5 h-3.5 mr-2" />
                In-App Notif
              </Button>
            </div>
            <div className="text-[10px] text-slate-400">
              Broadcast sends to channel subscribers · In-App sends to your connected user.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Socket.io Code Snippet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="text-[10px] bg-slate-900 text-slate-100 p-3 rounded-md overflow-x-auto max-h-32"><code>{`import { io } from 'socket.io-client'
const socket = io('/?XTransformPort=3003', {
  auth: { apiKey: '${apiKey || 'ucp_live_xxx'}', userId: 'user-123' }
})
socket.on('inapp:notification', (data) => console.log(data))
socket.emit('channel:subscribe', 'orders')`}</code></pre>
              <Button
                onClick={copySocketSnippet}
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live events */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Live Events
            </span>
            {connected && <span className="text-[10px] text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />listening</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {localEvents.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-8">
              {connected ? 'Waiting for events… send a test message above.' : 'Connect to start receiving events.'}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 font-mono text-xs">
              {localEvents.slice().reverse().map((e, i) => (
                <div key={i} className="py-2">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Badge variant="outline" className="text-[9px]">{e.type}</Badge>
                    <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-slate-900 mt-1">{e.event}</div>
                  <div className="text-slate-500 break-all">{JSON.stringify(e.payload).slice(0, 200)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div ref={logEndRef} />
    </div>
  )
}
