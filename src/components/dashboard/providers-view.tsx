'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/dashboard-api'
import { Project } from '@/app/page'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Settings, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

const PROVIDER_LABELS: Record<string, string> = {
  fcm: 'Firebase Cloud Messaging',
  email_smtp: 'البريد الإلكتروني (SMTP)',
  webpush: 'ويب فوري (VAPID)',
  inapp: 'داخل التطبيق',
  onesignal: 'OneSignal',
  twilio: 'Twilio SMS',
}

const PROVIDER_FIELDS: Record<string, Array<{ key: string; label: string; type?: string; placeholder?: string }>> = {
  fcm: [
    { key: 'projectId', label: 'معرّف مشروع Firebase', placeholder: 'my-app-12345' },
    { key: 'clientEmail', label: 'البريد الإلكتروني للعميل', placeholder: 'firebase-adminsdk@...' },
    { key: 'privateKey', label: 'المفتاح الخاص', placeholder: '-----BEGIN PRIVATE KEY-----\n...' },
  ],
  email_smtp: [
    { key: 'host', label: 'خادم SMTP', placeholder: 'smtp.gmail.com' },
    { key: 'port', label: 'المنفذ', placeholder: '587', type: 'number' },
    { key: 'username', label: 'اسم المستخدم', placeholder: 'user@example.com' },
    { key: 'password', label: 'كلمة المرور', placeholder: '••••••••', type: 'password' },
  ],
  webpush: [
    { key: 'vapidSubject', label: 'موضوع VAPID', placeholder: 'mailto:admin@example.com' },
    { key: 'vapidPublicKey', label: 'المفتاح العام', placeholder: 'BOPh…' },
    { key: 'vapidPrivateKey', label: 'المفتاح الخاص', placeholder: '—' },
  ],
  inapp: [],
}

export function ProvidersView({ project }: { project: Project }) {
  const [providers, setProviders] = useState<Awaited<ReturnType<typeof api.listProviders>>>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const ps = await api.listProviders(project.id)
      setProviders(ps)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [project.id])

  const openEditor = (name: string) => {
    setEditing(name)
    const p = providers.find((x) => x.name === name)
    setFormValues({})
    setConfigValues({})
    if (p?.config) {
      for (const [k, v] of Object.entries(p.config)) setConfigValues((prev) => ({ ...prev, [k]: String(v) }))
    }
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const credentials: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(formValues)) {
        if (v) {
          if (k === 'port') credentials[k] = Number(v)
          else credentials[k] = v
        }
      }
      const config: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(configValues)) {
        if (v) config[k] = v
      }
      await api.configureProvider(project.id, editing, credentials, config, true)
      toast.success(`تم تكوين "${PROVIDER_LABELS[editing] || editing}"`)
      setEditing(null)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline ml-2" />جاري التحميل…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900">المزودون</h1>
        <p className="text-sm text-slate-500">كوّن القنوات التي تريد تفعيلها. بدّل المزودين دون تغيير كود تطبيقك.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {providers.map((p) => (
          <Card key={p.name}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${p.configured ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    <Settings className={`w-5 h-5 ${p.configured ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-slate-900">{PROVIDER_LABELS[p.name] || p.displayName}</div>
                    <div className="text-xs text-slate-500 font-mono">{p.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.configured && p.health && (
                    p.health.healthy ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-amber-500" />
                  )}
                  <Switch checked={p.enabled} disabled={!p.configured} />
                </div>
              </div>

              {p.configured && p.credentials && Object.keys(p.credentials).length > 0 && (
                <div className="space-y-1 mb-3">
                  {Object.entries(p.credentials).slice(0, 3).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-mono text-slate-700 truncate max-w-[150px]" dir="ltr">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {p.health && (
                <div className="text-xs text-slate-500 mb-3">
                  الحالة: <span className={p.health.healthy ? 'text-emerald-600' : 'text-red-600'}>{p.health.healthy ? 'سليم' : 'متوقف'}</span>
                  {' · '}
                  <span>{p.health.latencyMs}ms</span>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => openEditor(p.name)} className="w-full">
                <Settings className="w-3.5 h-3.5 ml-2" />
                {p.configured ? 'تعديل الإعدادات' : 'تكوين'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تكوين {editing && PROVIDER_LABELS[editing]}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {PROVIDER_FIELDS[editing]?.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-4">هذا المزود لا يحتاج بيانات اعتماد.</div>
              ) : (
                PROVIDER_FIELDS[editing]?.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type={f.type === 'password' ? 'password' : 'text'}
                      value={formValues[f.key] || ''}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      dir={f.type === 'password' ? 'ltr' : 'rtl'}
                      className={f.type === 'password' ? 'text-right' : ''}
                    />
                  </div>
                ))
              )}
              {editing === 'email_smtp' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">عنوان المرسل</Label>
                  <Input
                    value={configValues.fromAddress || ''}
                    onChange={(e) => setConfigValues((prev) => ({ ...prev, fromAddress: e.target.value }))}
                    placeholder="no-reply@example.com"
                    dir="ltr"
                    className="text-right"
                  />
                </div>
              )}
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                <strong>ملاحظة:</strong> البيانات مشفّرة في الإنتاج. في وضع التطوير، المزودون يعملون في وضع محاكاة.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
