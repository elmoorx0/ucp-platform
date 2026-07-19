'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/dashboard-api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, ScrollText } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

export function AuditView() {
  const [items, setItems] = useState<Array<{ id: string; action: string; resource?: string | null; resourceId?: string | null; ip?: string | null; userAgent?: string | null; status: string; message?: string | null; createdAt: string }>>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.listAudit(page)
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500">{total} entries · page {page}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <ScrollText className="w-3.5 h-3.5 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <ScrollText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <div className="text-sm text-slate-500">No audit entries yet</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((a) => (
                <div key={a.id} className="p-3 flex items-start gap-3">
                  <Badge variant="outline" className={`text-[10px] ${a.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {a.status}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs text-slate-900">{a.action}</div>
                    {a.resource && <div className="text-[10px] text-slate-500 mt-0.5">on {a.resource}{a.resourceId ? ` · ${a.resourceId.slice(0, 12)}…` : ''}</div>}
                    {a.message && <div className="text-xs text-slate-600 mt-1">{a.message}</div>}
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                      {a.ip && ` · from ${a.ip}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {total > 50 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">Page {page} of {Math.ceil(total / 50)}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
