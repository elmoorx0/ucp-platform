'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/dashboard-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Send, Sparkles, Loader2, Zap, Globe, Shield } from 'lucide-react'
import { User } from '@/app/page'
import { toast } from 'sonner'

interface LoginViewProps {
  onLogin: (user: User) => void
  onRegister: (email: string, password: string, name?: string, tenantName?: string) => Promise<void>
  onSeed: () => Promise<{ user: { email: string; password: string }; project: { id: string; name: string }; apiKey?: { plaintext?: string } }>
}

export function LoginView({ onLogin, onRegister, onSeed }: LoginViewProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasUsers, setHasUsers] = useState<boolean | null>(null)

  useEffect(() => {
    api.health().then((h) => {
      const counts = (h as { checks?: { counts?: { users?: number } } }).checks?.counts
      setHasUsers((counts?.users ?? 0) > 0)
    }).catch(() => setHasUsers(false))
  }, [])

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    try {
      const res = await api.login(email, password)
      onLogin({ userId: res.user.id, email: res.user.email, name: res.user.name, role: res.user.role, tenantId: res.user.tenantId })
      toast.success('مرحباً بعودتك!')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!email || !password) return
    setLoading(true)
    try {
      await onRegister(email, password, name || undefined, tenantName || undefined)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleSeed = async () => {
    setLoading(true)
    try {
      const res = await onSeed()
      setEmail(res.user.email)
      setPassword(res.user.password)
      toast.success('تم إنشاء البيانات التجريبية. يمكنك الآن تسجيل الدخول.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-emerald-500/20">U</div>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-tight">منصة UCP</div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider">منصة الاتصالات الموحدة</div>
          </div>
        </div>
        <a href="https://github.com/elmoorx0/ucp-platform" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-700 hidden sm:block">الإصدار 1.6.0</a>
      </header>

      {/* Hero + form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Hero text */}
          <div className="space-y-6 text-center lg:text-right order-2 lg:order-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              منصة جاهزة للإنتاج
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
              منصة واحدة.
              <br/>
              <span className="text-emerald-600">كل القنوات.</span>
              <br/>
              جميع تطبيقاتك.
            </h1>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-md mx-auto lg:mx-0">
              أرسل الإشعارات والرسائل الفورية والبريد الإلكتروني عبر واجهة برمجية موحدة.
              بدّل المزودين دون تغيير كود تطبيقك. متعدد المستأجرين من الأساس.
            </p>
            <div className="flex items-center justify-center lg:justify-start gap-4 sm:gap-6 pt-2">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-slate-900">٤</div>
                <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide">مزودون</div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-slate-900">٥</div>
                <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide">خدمات</div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-emerald-600">∞</div>
                <div className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wide">مستأجرون</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Zap className="w-3.5 h-3.5 text-emerald-500" />
                توصيل فوري
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                مصادقة آمنة
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                متعدد اللغات
              </div>
            </div>
          </div>

          {/* Auth card */}
          <Card className="shadow-xl border-slate-200 order-1 lg:order-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">تسجيل الدخول إلى لوحة التحكم</CardTitle>
              {hasUsers === false && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <div className="font-medium mb-1">أول مرة هنا؟</div>
                  <button
                    onClick={handleSeed}
                    disabled={loading}
                    className="text-amber-900 underline hover:text-amber-700 font-medium"
                  >
                    اضغط هنا لإنشاء بيانات تجريبية
                  </button>
                  <span className="text-amber-700"> — ينشئ مستخدم مدير ومشروع ومفتاح API.</span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register')}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
                  <TabsTrigger value="register">حساب جديد</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs text-slate-600">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@ucp.local"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      dir="ltr"
                      className="text-right"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs text-slate-600">كلمة المرور</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      dir="ltr"
                      className="text-right"
                    />
                  </div>
                  <Button onClick={handleLogin} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
                    دخول
                  </Button>
                </TabsContent>

                <TabsContent value="register" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs text-slate-600">الاسم (اختياري)</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="اسمك"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email-r" className="text-xs text-slate-600">البريد الإلكتروني</Label>
                    <Input
                      id="email-r"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      dir="ltr"
                      className="text-right"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password-r" className="text-xs text-slate-600">كلمة المرور (٨ أحرف على الأقل)</Label>
                    <Input
                      id="password-r"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      dir="ltr"
                      className="text-right"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tenant" className="text-xs text-slate-600">اسم المؤسسة (اختياري)</Label>
                    <Input
                      id="tenant"
                      type="text"
                      placeholder="مؤسستي"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleRegister} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    إنشاء حساب
                  </Button>
                  <p className="text-xs text-slate-500 text-center">
                    أول مستخدم مسجل يصبح <strong>مديراً عاماً</strong>.
                  </p>
                </TabsContent>
              </Tabs>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-start gap-2 text-xs text-slate-500">
                  <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-500" />
                  <div>
                    <strong className="text-slate-700">بوابة الوقت الحقيقي</strong> تعمل بتقنية Socket.io —
                    توصيل فوري بدون polling.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-4 sm:px-8 py-4 text-center text-xs text-slate-400">
        مبني بـ Next.js · Prisma · Socket.io · TypeScript
      </footer>
    </div>
  )
}
