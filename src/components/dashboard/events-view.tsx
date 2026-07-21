'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/dashboard-api'
import { Project } from '@/app/page'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Radio, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { arSA } from 'date-fns/locale'

const SOURCE_LABELS: Record<string, string> = {
  notification: 'الإشعارات',
  realtime: 'الوقت الحقيقي',
  presence: 'الحضور',
  identity: 'الهوية',
  external: 'خارجي',
}

const SOURCE_COLORS: Record<string, string> = {
  notification: 'bg-blue-100 text-blue-700',
  realtime: 'bg-emerald-100 text-emerald-700',
  presence: 'bg-purple-100 text-purple-700',
  identity: 'bg-amber-100 text-amber-700',
  external: 'bg-slate-100 text-slate-700',
}

export function EventsView({ project }: { project: Project }) {
  const [items, setItems] = useState<Array<{ id: string; type: string; source: string; payload: string; channel?: string | null; delivered: boolean; createdAt: string }>>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.listEvents(project.id, page)
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">سجل الأحداث</h1>
          <p className="text-sm text-slate-500">{total} حدث · محفوظ للمراجعة</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <Radio className="w-3.5 h-3.5 ml-2" />
          تحديث
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline ml-2" />جاري التحميل…</div>
          ) : items.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <Radio className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <div className="text-sm text-slate-500 mb-1">لا توجد أحداث بعد</div>
              <div className="text-xs text-slate-400">تُنشأ الأحداث عند إرسال الإشعارات، تسجيل الأجهزة، إلخ.</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((e) => (
                <div key={e.id} className="p-3 flex items-start gap-3">
                  <Badge variant="outline" className={`text-[10px] font-mono flex-shrink-0 ${SOURCE_COLORS[e.source] || 'bg-slate-100'}`}>
                    {SOURCE_LABELS[e.source] || e.source}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs text-slate-900">{e.type}</div>
                    <div className="font-mono text-[10px] text-slate-500 break-all line-clamp-2 mt-0.5" dir="ltr">{e.payload}</div>
                    {e.channel && <div className="text-[10px] text-slate-400 mt-0.5">القناة: <code>{e.channel}</code></div>}
                  </div>
                  <div className="text-[10px] text-slate-400 flex-shrink-0 whitespace-nowrap">
                    {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true, locale: arSA })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {total > 50 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">صفحة {page} من {Math.ceil(total / 50)}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />السابق
            </Button>
            <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>
              التالي<ChevronLeft className="w-3.5 h-3.5 mr-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
