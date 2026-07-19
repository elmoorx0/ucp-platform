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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Settings, Loader2, CheckCircle2, AlertCircle, Plus } from 'lucide-react'
import { toast } from 'sonner'

const PROVIDER_FIELDS: Record<string, Array<{ key: string; label: string; type?: string; placeholder?: string }>> = {
  fcm: [
    { key: 'projectId', label: 'Firebase Project ID', placeholder: 'my-app-12345' },
    { key: 'clientEmail', label: 'Client Email', placeholder: 'firebase-adminsdk@my-app.iam.gserviceaccount.com' },
    { key: 'privateKey', label: 'Private Key', placeholder: '-----BEGIN PRIVATE KEY-----\n...' },
  ],
  email_smtp: [
    { key: 'host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
    { key: 'port', label: 'Port', placeholder: '587', type: 'number' },
    { key: 'username', label: 'Username', placeholder: 'user@example.com' },
    { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    { key: 'secure', label: 'Use TLS', placeholder: 'true', type: 'checkbox' },
  ],
  webpush: [
    { key: 'vapidSubject', label: 'VAPID Subject', placeholder: 'mailto:admin@example.com' },
    { key: 'vapidPublicKey', label: 'Public Key', placeholder: 'BOPh…' },
    { key: 'vapidPrivateKey', label: 'Private Key', placeholder: '—' },
  ],
  inapp: [],
}

const PROVIDER_CONFIG: Record<string, Array<{ key: string; label: string; placeholder?: string }>> = {
  email_smtp: [{ key: 'fromAddress', label: 'From Address', placeholder: 'no-reply@example.com' }],
  fcm: [],
  webpush: [],
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
      // Convert form values to proper types
      const credentials: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(formValues)) {
        if (v) {
          if (k === 'port' || k === 'secure') credentials[k] = k === 'secure' ? v === 'true' : Number(v)
          else credentials[k] = v
        }
      }
      const config: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(configValues)) {
        if (v) config[k] = v
      }
      await api.configureProvider(project.id, editing, credentials, config, true)
      toast.success(`Provider "${editing}" configured`)
      setEditing(null)
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Providers</h1>
        <p className="text-sm text-slate-500">Configure the channels you want to enable. Swap providers anytime without touching app code.</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {providers.map((p) => (
            <Card key={p.name}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center ${p.configured ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      <Settings className={`w-5 h-5 ${p.configured ? 'text-emerald-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-slate-900">{p.displayName}</div>
                      <div className="text-xs text-slate-500 font-mono">{p.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.configured && p.health && (
                      p.health.healthy ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                    <Switch checked={p.enabled} disabled={!p.configured} />
                  </div>
                </div>

                {p.configured && p.credentials && Object.keys(p.credentials).length > 0 && (
                  <div className="space-y-1 mb-3">
                    {Object.entries(p.credentials).slice(0, 3).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{k}</span>
                        <span className="font-mono text-slate-700">{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {p.health && (
                  <div className="text-xs text-slate-500 mb-3">
                    Health: <span className={p.health.healthy ? 'text-emerald-600' : 'text-red-600'}>{p.health.healthy ? 'OK' : 'Down'}</span>
                    {' · '}
                    <span>{p.health.latencyMs}ms</span>
                    {p.health.details && <span> · {p.health.details}</span>}
                  </div>
                )}

                <Button variant="outline" size="sm" onClick={() => openEditor(p.name)} className="w-full">
                  <Settings className="w-3.5 h-3.5 mr-2" />
                  {p.configured ? 'Edit configuration' : 'Configure'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure {editing}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {PROVIDER_FIELDS[editing]?.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-4">This provider needs no credentials.</div>
              ) : (
                PROVIDER_FIELDS[editing]?.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type={f.type === 'password' ? 'password' : 'text'}
                      value={formValues[f.key] || ''}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))
              )}

              {PROVIDER_CONFIG[editing] && PROVIDER_CONFIG[editing].length > 0 && (
                <div className="pt-3 border-t">
                  <div className="text-xs font-medium text-slate-700 mb-2">Configuration</div>
                  {PROVIDER_CONFIG[editing].map((f) => (
                    <div key={f.key} className="space-y-1.5 mb-2">
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        value={configValues[f.key] || ''}
                        onChange={(e) => setConfigValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-800">
                <strong>Note:</strong> Credentials are stored encrypted in production. In dev mode, providers run in simulation mode — no real notifications are sent.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
