'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/dashboard-api'
import type { NotificationItem } from '@/lib/dashboard-api'
import { Project } from '@/app/page'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Bell, Loader2, XCircle, CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { arSA } from 'date-fns/locale'

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  sent: CheckCircle2,
  delivered: CheckCircle2,
  failed: XCircle,
  pending: Clock,
  queued: Clock,
  sending: Loader2,
  partial: AlertCircle,
  cancelled: XCircle,
}

const STATUS_COLOR: Record<string, string> = {
  sent: 'text-emerald-600',
  delivered: 'text-emerald-600',
  failed: 'text-red-600',
  pending: 'text-amber-600',
  queued: 'text-slate-500',
  sending: 'text-blue-600',
  partial: 'text-amber-600',
  cancelled: 'text-slate-500',
}

const STATUS_LABELS: Record<string, string> = {
  sent: 'تم الإرسال',
  delivered: 'تم التسليم',
  failed: 'فشل',
  pending: 'قيد الانتظار',
  partial: 'جزئي',
  sending: 'جاري الإرسال',
  queued: 'في الطابور',
  cancelled: 'ملغي',
}

const CHANNEL_LABELS: Record<string, string> = {
  push: 'إشعار فوري',
  email: 'بريد',
  inapp: 'داخل التطبيق',
  webpush: 'ويب فوري',
  multi: 'متعدد',
}

const CHANNEL_COLORS: Record<string, string> = {
  push: 'bg-blue-100 text-blue-700',
  email: 'bg-purple-100 text-purple-700',
  inapp: 'bg-emerald-100 text-emerald-700',
  webpush: 'bg-pink-100 text-pink-700',
  multi: 'bg-amber-100 text-amber-700',
}

export function NotificationsView({ project }: { project: Project }) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<NotificationItem | null>(null)
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getNotification>> | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.listNotifications(project.id, page, statusFilter === 'all' ? undefined : statusFilter)
      setItems(res.items as NotificationItem[])
      setTotal(res.total)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [project.id, page, statusFilter])

  const loadDetail = async (n: NotificationItem) => {
    setSelected(n)
    setDetail(null)
    try {
      const d = await api.getNotification(project.id, n.id)
      setDetail(d)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await api.cancelNotification(project.id, id)
      toast.success('تم إلغاء الإشعار')
      load()
      if (selected?.id === id) setSelected(null)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">الإشعارات</h1>
          <p className="text-sm text-slate-500">{total} إجمالي · عرض {items.length}</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40 text-xs"><SelectValue placeholder="تصفية" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="sent">تم الإرسال</SelectItem>
            <SelectItem value="failed">فشل</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="partial">جزئي</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline ml-2" />جاري التحميل…</div>
          ) : items.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <Bell className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <div className="text-sm text-slate-500 mb-1">لا توجد إشعارات بعد</div>
              <div className="text-xs text-slate-400">أرسل واحداً من تبويب «إرسال»</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((n) => {
                const Icon = STATUS_ICON[n.status] || Clock
                const channelColor = CHANNEL_COLORS[n.channel] || 'bg-slate-100'
                return (
                  <div
                    key={n.id}
                    className="p-3 sm:p-4 flex items-center gap-3 hover:bg-slate-50 cursor-pointer"
                    onClick={() => loadDetail(n)}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${channelColor}`}>
                      <Bell className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm text-slate-900 truncate">{n.title}</div>
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">{CHANNEL_LABELS[n.channel] || n.channel}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 truncate">{n.body}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: arSA })}
                        {' · '}
                        <span className={STATUS_COLOR[n.status]}>
                          {n.deliveredCount} تم تسليمها / {n.failedCount} فشل / {n.totalTargets} إجمالي
                        </span>
                      </div>
                    </div>
                    <Icon className={`w-5 h-5 flex-shrink-0 ${STATUS_COLOR[n.status]} ${n.status === 'sending' ? 'animate-spin' : ''}`} />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{selected?.title}</DialogTitle>
            <DialogDescription className="text-xs">
              {selected && formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true, locale: arSA })}
              {' · '}
              <Badge variant="outline" className="text-[10px]">{CHANNEL_LABELS[selected?.channel || ''] || selected?.channel}</Badge>
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 text-sm text-slate-700">{selected.body}</div>

              <div className="grid grid-cols-4 gap-2">
                <Stat label="الإجمالي" value={selected.totalTargets} />
                <Stat label="تم التسليم" value={selected.deliveredCount} color="text-emerald-600" />
                <Stat label="فشل" value={selected.failedCount} color="text-red-600" />
                <Stat label="معلق" value={selected.pendingCount} color="text-amber-600" />
              </div>

              {detail?.targets && detail.targets.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-700 mb-1">تفاصيل التسليم ({detail.targets.length})</div>
                  <div className="max-h-56 overflow-y-auto border rounded-lg divide-y divide-slate-100">
                    {detail.targets.map((t) => (
                      <div key={t.id} className="p-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-[10px] flex-shrink-0">{CHANNEL_LABELS[t.channel] || t.channel}</Badge>
                          <span className="font-mono text-slate-500 truncate">{t.endUserId?.slice(-12) || t.deviceId?.slice(-12) || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-slate-600">{STATUS_LABELS[t.status] || t.status}</span>
                          {t.error && <span className="text-red-600 text-[10px]">{t.error}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {['pending', 'queued', 'sending'].includes(selected.status) && (
                <Button variant="destructive" onClick={() => handleCancel(selected.id)}>
                  إلغاء الإشعار
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">صفحة {page} من {Math.ceil(total / 20)}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
              السابق
            </Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>
              التالي
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="p-2 rounded-lg bg-slate-50 text-center">
      <div className={`text-lg font-bold ${color || 'text-slate-900'}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  )
}
