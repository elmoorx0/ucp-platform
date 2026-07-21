'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/dashboard-api'
import { Project } from '@/app/page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, Send, CheckCircle2, XCircle, Clock, Users, Smartphone, KeyRound, Activity } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid } from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  sent: '#10b981',
  delivered: '#10b981',
  failed: '#ef4444',
  pending: '#f59e0b',
  partial: '#f59e0b',
  sending: '#3b82f6',
  queued: '#64748b',
  cancelled: '#94a3b8',
}

const CHANNEL_COLORS: Record<string, string> = {
  push: '#3b82f6',
  email: '#8b5cf6',
  inapp: '#10b981',
  webpush: '#ec4899',
  multi: '#f59e0b',
  sms: '#06b6d4',
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
  email: 'بريد إلكتروني',
  inapp: 'داخل التطبيق',
  webpush: 'ويب فوري',
  multi: 'متعدد',
  sms: 'رسالة نصية',
}

export function OverviewView({ project }: { project: Project }) {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.getStats>> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const s = await api.getStats(project.id)
        if (!cancelled) setStats(s)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [project.id])

  if (loading || !stats) {
    return (
      <div className="p-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-72 bg-slate-100 rounded-xl" />
            <div className="h-72 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  const { notifStats, presenceStats, counts, project: proj } = stats

  const statusData = notifStats.byStatus.map((s) => ({ name: STATUS_LABELS[s.status] || s.status, value: s.count, fill: STATUS_COLORS[s.status] || '#94a3b8' }))
  const channelData = notifStats.byChannel.map((c) => ({ name: CHANNEL_LABELS[c.channel] || c.channel, value: c.count, fill: CHANNEL_COLORS[c.channel] || '#94a3b8' }))

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900">{proj?.name || project.name}</h1>
        <p className="text-sm text-slate-500">نظرة عامة · آخر ٣٠ يوماً</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={Bell} label="الإشعارات" value={counts.notifications || 0} color="bg-blue-50 text-blue-600" />
        <StatCard icon={Users} label="المستخدمون" value={counts.endUsers || 0} color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Smartphone} label="الأجهزة" value={counts.devices || 0} color="bg-purple-50 text-purple-600" />
        <StatCard icon={KeyRound} label="مفاتيح API" value={counts.apiKeys || 0} color="bg-amber-50 text-amber-600" />
        <StatCard icon={Activity} label="متصل الآن" value={presenceStats.onlineCount} color="bg-rose-50 text-rose-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">حسب الحالة</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-slate-400">لا توجد بيانات</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Cairo' }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, fontFamily: 'Cairo' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">حسب القناة</CardTitle>
          </CardHeader>
          <CardContent>
            {channelData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-slate-400">لا توجد بيانات</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.name}: ${e.value}`}>
                    {channelData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, fontFamily: 'Cairo' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">تفصيل الحالات</CardTitle>
        </CardHeader>
        <CardContent>
          {notifStats.byStatus.length === 0 ? (
            <div className="text-sm text-slate-400 py-4 text-center">لا توجد إشعارات بعد. أرسل واحداً من تبويب «إرسال».</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {notifStats.byStatus.map((s) => (
                <div key={s.status} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${STATUS_COLORS[s.status]}15`, color: STATUS_COLORS[s.status] }}>
                    {s.status === 'sent' || s.status === 'delivered' ? <CheckCircle2 className="w-5 h-5" /> :
                     s.status === 'failed' ? <XCircle className="w-5 h-5" /> :
                     <Clock className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-bold text-slate-900">{s.count}</div>
                    <div className="text-xs text-slate-500">{STATUS_LABELS[s.status] || s.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; color: string }) {
  return (
    <Card className="border-slate-200 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </CardContent>
    </Card>
  )
}
