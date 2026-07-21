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
  const [events, setEvents] = useState<Array<{ event: string; payload: unknown; timestamp: number; type: string }>>([])
  const [apiKey, setApiKey] = useState('')
  const [userId, setUserId] = useState('demo-user-' + Math.random().toString(36).slice(2, 8))
  const [channel, setChannel] = useState('test-channel')
  const [testMessage, setTestMessage] = useState('مرحباً من لوحة تحكم UCP!')
  const [copied, setCopied] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const addLog = (type: string, message: string) => {
    console.log(`[Realtime] ${type}: ${message}`)
  }

  const connect = () => {
    if (!apiKey || !userId) {
      toast.error('تحتاج إلى مفتاح API ومعرّف المستخدم')
      return
    }
    if (socket) socket.disconnect()

    const gatewayUrl = process.env.NEXT_PUBLIC_REALTIME_GATEWAY_URL || 'http://localhost:3003'
    const s = io(gatewayUrl, {
      auth: { apiKey, userId },
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
    })

    s.on('connect', () => {
      setConnected(true)
      addLog('success', `متصل كـ ${userId}`)
    })
    s.on('disconnect', () => {
      setConnected(false)
      addLog('info', 'انقطع الاتصال')
    })
    s.on('connect_error', (err: Error) => {
      addLog('error', `خطأ: ${err.message}`)
    })
    s.on('connected', (data: { socketId: string; projectId: string }) => {
      addLog('info', `معرّف Socket: ${data.socketId}`)
      s.emit('presence:watch')
      s.emit('channel:subscribe', channel, () => {
        addLog('info', `مشترك في القناة: ${channel}`)
      })
    })
    s.on('presence:update', (data: { userId: string; status: string }) => {
      addLog('presence', `الحضور: ${data.userId} → ${data.status}`)
    })
    s.on('inapp:notification', (data: { notificationId: string; title: string; body: string }) => {
      addLog('notification', `إشعار: ${data.title}`)
      setEvents((prev) => [...prev, { event: 'inapp:notification', payload: data, timestamp: Date.now(), type: 'notification' }])
    })
    s.on('test-event', (data: unknown) => {
      addLog('message', `حدث: ${JSON.stringify(data).slice(0, 80)}`)
      setEvents((prev) => [...prev, { event: 'test-event', payload: data, timestamp: Date.now(), type: 'message' }])
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

  const sendTestMessage = async () => {
    if (!channel || !testMessage) return
    try {
      const res = await fetch('/api/v1/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ channel, event: 'test-event', payload: { text: testMessage, from: 'dashboard' }, projectId: project.id }),
      })
      const json = await res.json()
      if (json.success) toast.success(`تم الإرسال إلى ${json.data.delivered} مستلم`)
      else toast.error(json.error?.message || 'فشل')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const sendInApp = async () => {
    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ channel: 'inapp', to: [userId], title: 'اختبار من اللوحة', body: testMessage, projectId: project.id }),
      })
      const json = await res.json()
      if (json.success) toast.success('تم إرسال إشعار داخل التطبيق')
      else toast.error(json.error?.message || 'فشل')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const copySocketSnippet = () => {
    const code = `import { io } from 'socket.io-client'

const socket = io('${process.env.NEXT_PUBLIC_REALTIME_GATEWAY_URL || 'http://localhost:3003'}', {
  auth: { apiKey: '${apiKey || 'ucp_live_xxx'}', userId: 'user-123' }
})

socket.on('connect', () => console.log('متصل'))
socket.on('inapp:notification', (data) => console.log('إشعار:', data))`
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const [localEvents, setLocalEvents] = useState<Array<{ event: string; payload: unknown; timestamp: number; type: string }>>([])

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900">مراقبة الوقت الحقيقي</h1>
        <p className="text-sm text-slate-500">اتصل ببوابة Socket.io وراقب الأحداث المباشرة.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="w-4 h-4" />
            الاتصال
            <Badge variant={connected ? 'default' : 'secondary'} className="text-[10px]">
              {connected ? 'متصل' : 'غير متصل'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">مفتاح API</Label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="ucp_live_xxx" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">معرّف المستخدم</Label>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="user-001" dir="ltr" className="text-right" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">القناة</Label>
              <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="test-channel" dir="ltr" className="text-right" />
            </div>
          </div>
          <div className="flex gap-2">
            {!connected ? (
              <Button onClick={connect} disabled={!apiKey || !userId} className="bg-slate-900 hover:bg-slate-800">
                <Radio className="w-4 h-4 ml-2" />
                اتصال
              </Button>
            ) : (
              <Button onClick={disconnect} variant="outline">
                قطع الاتصال
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Send className="w-4 h-4" />
              إرسال رسالة اختبار
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="نص الرسالة" />
            <div className="flex gap-2">
              <Button onClick={sendTestMessage} disabled={!apiKey} variant="outline" size="sm" className="flex-1">
                <Send className="w-3.5 h-3.5 ml-2" />
                بث
              </Button>
              <Button onClick={sendInApp} disabled={!apiKey} variant="outline" size="sm" className="flex-1">
                <Activity className="w-3.5 h-3.5 ml-2" />
                إشعار
              </Button>
            </div>
            <div className="text-[10px] text-slate-400">
              البث يُرسل لمشتركي القناة · الإشعار يُرسل للمستخدم المتصل.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              كود Socket.io
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="text-[10px] bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-32" dir="ltr"><code>{`import { io } from 'socket.io-client'
const socket = io('...', {
  auth: { apiKey: '${apiKey ? '***' : 'ucp_live_xxx'}', userId: 'user-123' }
})
socket.on('inapp:notification', (d) => console.log(d))
socket.emit('channel:subscribe', 'orders')`}</code></pre>
              <Button onClick={copySocketSnippet} size="sm" variant="outline" className="absolute top-2 left-2">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              الأحداث المباشرة
            </span>
            {connected && <span className="text-[10px] text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />يستمع</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {localEvents.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-8">
              {connected ? 'في انتظار الأحداث… أرسل رسالة اختبار.' : 'اتصل لبدء استقبال الأحداث.'}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 font-mono text-xs">
              {localEvents.slice().reverse().map((e, i) => (
                <div key={i} className="py-2">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Badge variant="outline" className="text-[9px]">{e.type}</Badge>
                    <span>{new Date(e.timestamp).toLocaleTimeString('ar-SA')}</span>
                  </div>
                  <div className="text-slate-900 mt-1">{e.event}</div>
                  <div className="text-slate-500 break-all" dir="ltr">{JSON.stringify(e.payload).slice(0, 200)}</div>
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
