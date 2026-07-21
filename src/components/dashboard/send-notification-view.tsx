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
  const [title, setTitle] = useState('مرحباً من UCP')
  const [body, setBody] = useState('هذا الإشعار تم إرساله عبر منصة الاتصالات الموحدة.')
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
      toast.success(`تم إرسال الإشعار إلى ${res.totalTargets} مستهدف`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const channelBg = (c: string) => ({
    push: 'bg-blue-500',
    email: 'bg-purple-500',
    inapp: 'bg-emerald-500',
    webpush: 'bg-pink-500',
    multi: 'bg-amber-500',
  }[c] || 'bg-slate-500')

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900">إرسال إشعار</h1>
        <p className="text-sm text-slate-500">أنشئ وأرسل إشعاراً عبر أي قناة مُفعّلة.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Composer */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">القناة والاستهداف</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">القناة</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inapp">داخل التطبيق (فوري)</SelectItem>
                      <SelectItem value="push">إشعار فوري (FCM)</SelectItem>
                      <SelectItem value="email">بريد إلكتروني (SMTP)</SelectItem>
                      <SelectItem value="webpush">ويب فوري (VAPID)</SelectItem>
                      <SelectItem value="multi">متعدد القنوات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">الاستهداف</Label>
                  <Select value={targetingType} onValueChange={(v) => setTargetingType(v as typeof targetingType)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">مستخدمون محددون</SelectItem>
                      <SelectItem value="topic">موضوع / وسم</SelectItem>
                      <SelectItem value="broadcast">بث جماعي (الكل)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {targetingType !== 'broadcast' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">
                    {targetingType === 'topic' ? 'اسم الموضوع' : 'معرّفات المستخدمين (مفصولة بفواصل)'}
                  </Label>
                  <Input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder={targetingType === 'topic' ? 'vip-users' : 'user-001, user-002'}
                    dir="ltr"
                    className="text-right"
                  />
                  {targetingType === 'user' && (
                    <div className="text-xs text-slate-400">استخدم المعرّف الخارجي الذي سجلته لكل مستخدم.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">المحتوى</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">العنوان</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
                <div className="text-[10px] text-slate-400 text-left">{title.length}/100</div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">النص</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1000} />
                <div className="text-[10px] text-slate-400 text-left">{body.length}/1000</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">رابط الصورة (اختياري)</Label>
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" dir="ltr" className="text-right" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">الأولوية</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">منخفضة</SelectItem>
                      <SelectItem value="normal">عادية</SelectItem>
                      <SelectItem value="high">عالية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSend} disabled={sending || !title || !body} className="w-full bg-slate-900 hover:bg-slate-800 h-11">
            {sending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
            {sending ? 'جاري الإرسال…' : 'إرسال الإشعار'}
          </Button>
        </div>

        {/* Preview & result */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">معاينة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border">
                <div className="flex items-start gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${channelBg(channel)}`}>
                    <Send className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{title || 'عنوان الإشعار'}</div>
                    <div className="text-xs text-slate-600 mt-0.5 line-clamp-3">{body || 'نص الإشعار'}</div>
                    {imageUrl && <img src={imageUrl} alt="" className="mt-2 rounded-md w-full h-24 object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-2">{channel}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">{channel}</Badge>
                <Badge variant="outline" className="text-[10px]">{targetingType === 'user' ? 'مستخدمون' : targetingType === 'topic' ? 'موضوع' : 'بث جماعي'}</Badge>
                <Badge variant="outline" className="text-[10px]">{priority === 'low' ? 'منخفضة' : priority === 'high' ? 'عالية' : 'عادية'}</Badge>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  تم الإرسال
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div className="text-slate-500">معرّف الإشعار:</div>
                <div className="font-mono text-[10px] text-slate-700 break-all">{result.id}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-slate-50 text-center">
                    <div className="text-lg font-bold text-slate-900">{result.totalTargets}</div>
                    <div className="text-[10px] text-slate-500">المستهدفون</div>
                  </div>
                  <div className="p-2 rounded bg-emerald-50 text-center">
                    <div className="text-lg font-bold text-emerald-700">{result.delivered}</div>
                    <div className="text-[10px] text-emerald-600">تم التسليم</div>
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
