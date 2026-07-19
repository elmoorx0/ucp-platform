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
import { Checkbox } from '@/components/ui/checkbox'

const ALL_SCOPES = [
  { id: 'notifications:send', label: 'Send notifications' },
  { id: 'notifications:read', label: 'Read notifications' },
  { id: 'notifications:cancel', label: 'Cancel notifications' },
  { id: 'devices:register', label: 'Register devices' },
  { id: 'devices:read', label: 'Read devices' },
  { id: 'users:write', label: 'Write end users' },
  { id: 'users:read', label: 'Read end users' },
  { id: 'presence:read', label: 'Read presence' },
  { id: 'events:read', label: 'Read events' },
  { id: 'realtime:broadcast', label: 'Broadcast realtime' },
  { id: 'stats:read', label: 'Read stats' },
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
      toast.success('API key created')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      await api.revokeApiKey(project.id, id)
      toast.success('API key revoked')
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">API Keys</h1>
          <p className="text-sm text-slate-500">Issue scoped keys for client apps to authenticate REST API requests.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />
          New Key
        </Button>
      </div>

      {/* New key dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Mobile app production key" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scopes</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3 bg-slate-50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={selectedScopes.includes('*')} onCheckedChange={() => toggleScope('*')} />
                  <span className="text-sm font-medium">All permissions (<code>*</code>)</span>
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
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show new key dialog */}
      <Dialog open={!!newKeyData} onOpenChange={(o) => !o && setNewKeyData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy this key now — it will not be shown again. Treat it like a password.
            </DialogDescription>
          </DialogHeader>
          {newKeyData && (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-slate-900 text-emerald-400 font-mono text-xs break-all">
                {newKeyData.plaintext}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Prefix: <code>{newKeyData.keyPrefix}…</code></span>
                <Button onClick={copyKey} variant="outline" size="sm">
                  {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setNewKeyData(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keys list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</div>
          ) : keys.length === 0 ? (
            <div className="p-12 text-center">
              <KeyRound className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <div className="text-sm text-slate-500 mb-1">No API keys yet</div>
              <div className="text-xs text-slate-400">Create one to start using the REST API</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {keys.map((k) => (
                <div key={k.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center">
                      <KeyRound className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm text-slate-900 truncate">{k.name}</div>
                        <Badge variant={k.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{k.status}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{k.keyPrefix}…</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Created {formatDistanceToNow(new Date(k.createdAt), { addSuffix: true })}
                        {k.lastUsedAt && ` · Last used ${formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })}`}
                        {k.lastUsedIp && ` from ${k.lastUsedIp}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-wrap gap-1 justify-end max-w-xs">
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
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Revoke API key "{k.name}"?</DialogTitle>
                            <DialogDescription>
                              This action cannot be undone. Any client using this key will immediately lose access.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div>Key prefix: <code>{k.keyPrefix}…</code></div>
                          </div>
                          <DialogFooter>
                            <DialogTrigger asChild>
                              <Button variant="outline">Cancel</Button>
                            </DialogTrigger>
                            <Button variant="destructive" onClick={() => handleRevoke(k.id)}>Revoke</Button>
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

      {/* Usage example */}
      <Card className="bg-slate-900 text-slate-100 border-slate-800">
        <CardContent className="p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Quick start</div>
          <pre className="text-xs overflow-x-auto"><code>{`curl -X POST https://your-domain/api/v1/notifications \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ucp_live_xxxxxxxxxxxxxxxx" \\
  -d '{
    "channel": "inapp",
    "to": ["user-001", "user-002"],
    "title": "Hello",
    "body": "Sent via UCP"
  }'`}</code></pre>
        </CardContent>
      </Card>
    </div>
  )
}
