'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/dashboard-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/theme-provider'
import { Moon, Sun, CheckCircle2, XCircle, Database, Key, Server, Globe, Bell, Shield, Zap, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

export function SettingsView() {
  const { theme, toggleTheme } = useTheme()
  const [health, setHealth] = useState<Record<string, unknown> | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    api.health().then((h) => setHealth(h as Record<string, unknown>)).catch(() => {})
  }, [])

  const configStatus = (health as { checks?: { config?: Record<string, boolean> } })?.checks?.config || {}
  const dbCheck = (health as { checks?: { database?: { ok: boolean; url?: string } } })?.checks?.database
  const gatewayCheck = (health as { checks?: { gateway?: { ok: boolean; configured?: boolean } } })?.checks?.gateway
  const counts = (health as { checks?: { counts?: Record<string, number> } })?.checks?.counts

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const envVars = [
    { key: 'DATABASE_URL', label: 'رابط قاعدة البيانات', configured: configStatus.database as boolean, icon: Database, value: dbCheck?.url },
    { key: 'JWT_SECRET', label: 'مفتاح JWT', configured: configStatus.jwtSecret as boolean, icon: Key },
    { key: 'API_KEY_HASH_SECRET', label: 'مفتاح تشفير API', configured: configStatus.apiKeyHashSecret as boolean, icon: Shield },
    { key: 'INTERNAL_API_TOKEN', label: 'رمز API الداخلي', configured: configStatus.internalApiToken as boolean, icon: Key },
    { key: 'REALTIME_GATEWAY_URL', label: 'رابط البوابة الفورية', configured: configStatus.gatewayUrl as boolean, icon: Server },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-4xl">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">الإعدادات</h1>
        <p className="text-sm text-slate-500">إدارة تفضيلات النظام والبيئة</p>
      </div>

      {/* Appearance */}
      <Card className="dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">المظهر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <div className="flex items-center gap-3">
              {theme === 'light' ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{theme === 'light' ? 'الوضع الفاتح' : 'الوضع الداكن'}</div>
                <div className="text-xs text-slate-500">{theme === 'light' ? 'مظهر نهاري مريح' : 'مظهر ليلي مريح للعين'}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="w-4 h-4 ml-2" /> : <Sun className="w-4 h-4 ml-2" />}
              {theme === 'light' ? 'تفعيل داكن' : 'تفعيل فاتح'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card className="dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">حالة النظام</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Database */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-slate-400" />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">قاعدة البيانات</div>
                <div className="text-xs text-slate-500 font-mono truncate max-w-[200px] sm:max-w-xs" dir="ltr">{dbCheck?.url || 'غير مضبوط'}</div>
              </div>
            </div>
            {dbCheck?.ok ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3 ml-1" />متصل</Badge>
            ) : (
              <Badge variant="destructive"><XCircle className="w-3 h-3 ml-1" />غير متصل</Badge>
            )}
          </div>

          {/* Gateway */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-slate-400" />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">بوابة الوقت الحقيقي</div>
                <div className="text-xs text-slate-500">
                  {gatewayCheck?.configured ? 'مضبوط' : 'غير مضبوط — الوقت الحقيقي معطّل'}
                </div>
              </div>
            </div>
            {gatewayCheck?.ok ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3 ml-1" />يعمل</Badge>
            ) : gatewayCheck?.configured ? (
              <Badge variant="destructive"><XCircle className="w-3 h-3 ml-1" />غير متصل</Badge>
            ) : (
              <Badge variant="secondary">غير مضبوط</Badge>
            )}
          </div>

          {/* Counts */}
          {counts && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <CountCard label="مشاريع" value={counts.projects || 0} />
              <CountCard label="مستخدمون" value={counts.users || 0} />
              <CountCard label="مفاتيح" value={counts.apiKeys || 0} />
              <CountCard label="إشعارات" value={counts.notifications || 0} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card className="dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">متغيرات البيئة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {envVars.map((env) => {
            const Icon = env.icon
            return (
              <div key={env.key} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{env.label}</div>
                    <div className="text-xs text-slate-500 font-mono" dir="ltr">{env.key}</div>
                  </div>
                </div>
                {env.configured ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3 ml-1" />مضبوط
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex-shrink-0">
                    <XCircle className="w-3 h-3 ml-1" />افتراضي
                  </Badge>
                )}
              </div>
            )
          })}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300 mt-3">
            <Zap className="w-3.5 h-3.5 inline ml-1" />
            المتغيرات الافتراضية تعمل للتطوير. للإنتاج، اضبط متغيرات مخصصة في Vercel Dashboard ← Settings ← Environment Variables.
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card className="dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">روابط مفيدة</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <QuickLink href="/api/docs" label="توثيق OpenAPI" icon={Globe} />
          <QuickLink href="/api/health" label="فحص الصحة" icon={CheckCircle2} />
          <QuickLink href="/api/metrics" label="مقاييس Prometheus" icon={Bell} />
          <QuickLink href="https://github.com/elmoorx0/ucp-platform" label="المستودع على GitHub" icon={Globe} external />
        </CardContent>
      </Card>
    </div>
  )
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  )
}

function QuickLink({ href, label, icon: Icon, external }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : '_self'}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
    >
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{label}</span>
      <Copy className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
    </a>
  )
}
