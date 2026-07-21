'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/dashboard-api'
import { Project } from '@/app/page'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Users, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { arSA } from 'date-fns/locale'

export function EndUsersView({ project }: { project: Project }) {
  const [items, setItems] = useState<Array<{ id: string; externalId: string; email?: string | null; name?: string | null; language: string; tags: string; status: string; createdAt: string; _count?: { devices: number } }>>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.listEndUsers(project.id, page)
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [project.id, page])

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900">المستخدمون</h1>
        <p className="text-sm text-slate-500">{total} إجمالي · صفحة {page}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline ml-2" />جاري التحميل…</div>
          ) : items.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <div className="text-sm text-slate-500 mb-1">لا يوجد مستخدمون مسجلون</div>
              <div className="text-xs text-slate-400">سجّل مستخدمين عبر <code className="bg-slate-100 px-1 py-0.5 rounded">POST /api/v1/users</code></div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((u) => {
                const tags = JSON.parse(u.tags || '[]') as string[]
                return (
                  <div key={u.id} className="p-3 sm:p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700 flex-shrink-0">
                      {(u.name || u.externalId)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm text-slate-900 truncate">{u.name || u.externalId}</div>
                        <Badge variant="outline" className="text-[10px]">{u.status === 'active' ? 'نشط' : u.status}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 font-mono truncate" dir="ltr">{u.externalId}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {u.email && <span dir="ltr">{u.email} · </span>}
                        {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true, locale: arSA })}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px]"><Smartphone className="w-3 h-3 ml-1" />{u._count?.devices || 0}</Badge>
                      {tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap justify-end max-w-[120px]">
                          {tags.slice(0, 2).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[9px]">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {total > 20 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">صفحة {page} من {Math.ceil(total / 20)}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />السابق
            </Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>
              التالي<ChevronLeft className="w-3.5 h-3.5 mr-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
