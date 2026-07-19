'use client'

import { useState } from 'react'
import { api } from '@/lib/dashboard-api'
import { Project } from '@/app/page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Send, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export function SendNotificationView({ project }: { project: Project }) {
  const [channel, setChannel] = useState<'inapp' | 'push' | 'email' | 'webpush' | 'multi'>('inapp')
  const [targetingType, setTargetingType] = useState<'user' | 'topic' | 'broadcast'>('user')
  const [to, setTo] = useState('user-001, user-002')
  const [title, setTitle] = useState('Hello from UCP')
  const [body, setBody] = useState('This notification was sent through the Universal Communication Platform.')
  const [imageUrl, setImageUrl] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ id: string; totalTargets: number; delivered: number } | null>(null)

  const handleSend = async () => {
    if (!title || !body) return
    setSending(true)
    setResult(null)
    try {
      const targets = to.split(',').map((s) => s.trim()).filter(Boolean)
      const targetingData = targetingType === 'broadcast' ? {} :
                            targetingType === 'topic' ? { topic: targets[0] || 'general' } :
                            { externalUserIds: targets }

      const res = await api.sendNotification(project.id, {
        channel,
        title,
        body,
        imageUrl: imageUrl || undefined,
        targetingType,
        targetingData,
        priority,
      }) as { id: string; totalTargets: number; delivered: number; failed: number; pending: number; status: string }

      setResult({ id: res.id, totalTargets: res.totalTargets, delivered: res.delivered })
      toast.success(`Notification sent to ${res.totalTargets} target(s)`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Send Notification</h1>
        <p className="text-sm text-slate-500">Compose and dispatch a notification through any configured channel.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Composer */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Channel & Targeting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Channel</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inapp">In-App (realtime)</SelectItem>
                      <SelectItem value="push">Push (FCM)</SelectItem>
                      <SelectItem value="email">Email (SMTP)</SelectItem>
                      <SelectItem value="webpush">Web Push (VAPID)</SelectItem>
                      <SelectItem value="multi">Multi-channel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Targeting</Label>
                  <Select value={targetingType} onValueChange={(v) => setTargetingType(v as typeof targetingType)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Specific users</SelectItem>
                      <SelectItem value="topic">Topic / tag</SelectItem>
                      <SelectItem value="broadcast">Broadcast (all users)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {targetingType !== 'broadcast' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {targetingType === 'topic' ? 'Topic name' : 'User IDs (comma-separated)'}
                  </Label>
                  <Input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder={targetingType === 'topic' ? 'vip-users' : 'user-001, user-002'}
                  />
                  {targetingType === 'user' && (
                    <div className="text-xs text-slate-400">Use the external ID you registered for each user.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
                <div className="text-[10px] text-slate-400 text-right">{title.length}/100</div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Body</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1000} />
                <div className="text-[10px] text-slate-400 text-right">{body.length}/1000</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Image URL (optional)</Label>
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSend} disabled={sending || !title || !body} className="w-full bg-slate-900 hover:bg-slate-800">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {sending ? 'Sending…' : 'Send notification'}
          </Button>
        </div>

        {/* Preview & result */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border">
                <div className="flex items-start gap-2">
                  <div className={`w-8 h-8 rounded-md flex-shrink-0 ${channelBg(channel)}`}>
                    <Send className="w-3 h-3 m-2.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{title || 'Notification title'}</div>
                    <div className="text-xs text-slate-600 mt-0.5 line-clamp-3">{body || 'Notification body'}</div>
                    {imageUrl && <img src={imageUrl} alt="" className="mt-2 rounded-md w-full h-24 object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-2">UCP · {channel}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px] capitalize">{channel}</Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{targetingType}</Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{priority}</Badge>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Sent
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div className="text-slate-500">Notification ID:</div>
                <div className="font-mono text-[10px] text-slate-700 break-all">{result.id}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-slate-50 text-center">
                    <div className="text-lg font-semibold text-slate-900">{result.totalTargets}</div>
                    <div className="text-[10px] text-slate-500 uppercase">Targets</div>
                  </div>
                  <div className="p-2 rounded bg-emerald-50 text-center">
                    <div className="text-lg font-semibold text-emerald-700">{result.delivered}</div>
                    <div className="text-[10px] text-emerald-600 uppercase">Delivered</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function channelBg(c: string): string {
  return {
    push: 'bg-blue-500',
    email: 'bg-purple-500',
    inapp: 'bg-emerald-500',
    webpush: 'bg-pink-500',
    multi: 'bg-amber-500',
  }[c] || 'bg-slate-500'
}
