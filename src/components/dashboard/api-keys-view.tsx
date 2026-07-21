'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/dashboard-api'
import { Project } from '@/app/page'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { KeyRound, Plus, Loader2, Copy, Check, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { arSA } from 'date-fns/locale'
import { Checkbox } from '@/components/ui/checkbox'

const ALL_SCOPES = [
  { id: 'notifications:send', label: 'إرسال الإشعارات' },
  { id: 'notifications:read', label: 'قراءة الإشعارات' },
  { id: 'notifications:cancel', label: 'إلغاء الإشعارات' },
  { id: 'devices:register', label: 'تسجيل الأجهزة' },
  { id: 'devices:read', label: 'قراءة الأجهزة' },
  { id: 'users:write', label: 'كتابة المستخدمين' },
  { id: 'users:read', label: 'قراءة المستخدمين' },
  { id: 'presence:read', label: 'قراءة الحضور' },
  { id: 'events:read', label: 'قراءة الأحداث' },
  { id: 'realtime:broadcast', label: 'بث الوقت الحقيقي' },
  { id: 'stats:read', label: 'قراءة الإحصائيات' },
]

export function ApiKeysView({ project }: { project: Project }) {
  const [keys, setKeys] = useState<Awaited<ReturnType<typeof api.listApiKeys>>>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['*'])
  const [newKeyData, setNewKeyData] = useState<{ plaintext: string; keyPrefix: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const loadKeys = async () => {
    setLoading(true)
    try {
      const ks = await api.listApiKeys(project.id)
      setKeys(ks)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadKeys() }, [project.id])

  const handleCreate = async () => {
    if (!newName) return
    try {
      const created = await api.createApiKey(project.id, newName, selectedScopes.includes('*') ? ['*'] : selectedScopes)
      setNewKeyData({ plaintext: created.plaintext, keyPrefix: created.keyPrefix })
      setNewName('')
      setSelectedScopes(['*'])
      setCreating(false)
      loadKeys()
      toast.success('تم إنشاء مفتاح API')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      await api.revokeApiKey(project.id, id)
      toast.success('تم إبطال المفتاح')
      loadKeys()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const copyKey = () => {
    if (newKeyData) {
      navigator.clipboard.writeText(newKeyData.plaintext)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const toggleScope = (scope: string) => {
    if (scope === '*') {
      setSelectedScopes(['*'])
      return
    }
    setSelectedScopes((prev) => {
      const without = prev.filter((s) => s !== '*')
      if (without.includes(scope)) return without.filter((s) => s !== scope)
      return [...without, scope]
    })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">مفاتيح API</h1>
          <p className="text-sm text-slate-500">أنشئ مفاتيح محددة الصلاحيات لتطبيقاتك.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-slate-900 hover:bg-slate-800 flex-shrink-0">
          <Plus className="w-4 h-4 ml-2" />
          <span className="hidden sm:inline">مفتاح جديد</span>
          <span className="sm:hidden">جديد</span>
        </Button>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنشاء مفتاح API</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">الاسم</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="مفتاح تطبيق الإنتاج" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الصلاحيات</Label>
              <div className="space-y-2 max-h-56 overflow-y-auto border rounded-lg p-3 bg-slate-50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={selectedScopes.includes('*')} onCheckedChange={() => toggleScope('*')} />
                  <span className="text-sm font-medium">كل الصلاحيات (<code>*</code>)</span>
                </label>
                <div className="border-t pt-2 mt-2 space-y-2">
                  {ALL_SCOPES.map((scope) => (
                    <label key={scope.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedScopes.includes(scope.id)}
                        onCheckedChange={() => toggleScope(scope.id)}
                        disabled={selectedScopes.includes('*')}
                      />
                      <div>
                        <div className="text-sm"><code>{scope.id}</code></div>
                        <div className="text-xs text-slate-500">{scope.label}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={!newName}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newKeyData} onOpenChange={(o) => !o && setNewKeyData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تم إنشاء المفتاح</DialogTitle>
            <DialogDescription>
              انسخ هذا المفتاح الآن — لن يظهر مرة أخرى. عامله ككلمة مرور.
            </DialogDescription>
          </DialogHeader>
          {newKeyData && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-900 text-emerald-400 font-mono text-xs break-all">
                {newKeyData.plaintext}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>البادئة: <code>{newKeyData.keyPrefix}…</code></span>
                <Button onClick={copyKey} variant="outline" size="sm">
                  {copied ? <Check className="w-3 h-3 ml-1" /> : <Copy className="w-3 h-3 ml-1" />}
                  {copied ? 'تم النسخ' : 'نسخ'}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setNewKeyData(null)}>تم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline ml-2" />جاري التحميل…</div>
          ) : keys.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <KeyRound className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <div className="text-sm text-slate-500 mb-1">لا توجد مفاتيح API بعد</div>
              <div className="text-xs text-slate-400">أنشئ واحداً للبدء باستخدام REST API</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {keys.map((k) => (
                <div key={k.id} className="p-3 sm:p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <KeyRound className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm text-slate-900 truncate">{k.name}</div>
                        <Badge variant={k.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{k.status === 'active' ? 'نشط' : 'ملغي'}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{k.keyPrefix}…</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {formatDistanceToNow(new Date(k.createdAt), { addSuffix: true, locale: arSA })}
                        {k.lastUsedAt && ` · آخر استخدام ${formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true, locale: arSA })}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="hidden md:flex flex-wrap gap-1 justify-end max-w-xs">
                      {JSON.parse(k.scopes || '[]').slice(0, 3).map((s: string) => (
                        <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
                      ))}
                      {JSON.parse(k.scopes || '[]').length > 3 && (
                        <Badge variant="outline" className="text-[10px]">+{JSON.parse(k.scopes || '[]').length - 3}</Badge>
                      )}
                    </div>
                    {k.status === 'active' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>إبطال المفتاح "{k.name}"؟</DialogTitle>
                            <DialogDescription>
                              لا يمكن التراجع عن هذا الإجراء. أي عميل يستخدم هذا المفتاح سيفقد الوصول فوراً.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div>بادئة المفتاح: <code>{k.keyPrefix}…</code></div>
                          </div>
                          <DialogFooter>
                            <DialogTrigger asChild>
                              <Button variant="outline">إلغاء</Button>
                            </DialogTrigger>
                            <Button variant="destructive" onClick={() => handleRevoke(k.id)}>إبطال</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 text-slate-100 border-slate-800">
        <CardContent className="p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">دليل سريع</div>
          <pre className="text-xs overflow-x-auto" dir="ltr"><code>{`curl -X POST https://your-domain/api/v1/notifications \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ucp_live_xxxxxxxxxxxxxxxx" \\
  -d '{
    "channel": "inapp",
    "to": ["user-001", "user-002"],
    "title": "مرحباً",
    "body": "تم الإرسال عبر UCP"
  }'`}</code></pre>
        </CardContent>
      </Card>
    </div>
  )
}
