'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/dashboard-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Radio, Send, Sparkles, Loader2 } from 'lucide-react'
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

  // Check if there's any user yet — if not, show seed banner
  const [hasUsers, setHasUsers] = useState<boolean | null>(null)
  useEffect(() => {
    api.health().then((h) => {
      setHasUsers((h.checks?.counts?.users ?? 0) > 0)
    }).catch(() => setHasUsers(false))
  }, [])

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    try {
      const res = await api.login(email, password)
      onLogin({ userId: res.user.id, email: res.user.email, name: res.user.name, role: res.user.role, tenantId: res.user.tenantId })
      toast.success('Welcome back!')
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
      toast.success('Demo data seeded. You can now login with the seeded credentials.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50 flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-bold text-white">U</div>
          <div>
            <div className="font-semibold text-slate-900 text-sm leading-tight">Universal Communication Platform</div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider">Communication as a Service · Multi-Tenant</div>
          </div>
        </div>
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-700">v1.0.0</a>
      </header>

      {/* Hero + form */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Hero text */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
              <Sparkles className="w-3 h-3" />
              Production-Ready CPaaS
            </div>
            <h1 className="text-4xl font-bold text-slate-900 leading-tight">
              One platform.<br/>
              <span className="text-emerald-600">Every channel.</span><br/>
              All your apps.
            </h1>
            <p className="text-slate-600 text-base leading-relaxed">
              Send push notifications, emails, in-app messages, and realtime updates
              through a single REST API. Swap providers without touching your app code.
              Multi-tenant by design — built for scale.
            </p>
            <div className="flex items-center gap-6 pt-2">
              <div>
                <div className="text-2xl font-bold text-slate-900">4</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">Providers</div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <div className="text-2xl font-bold text-slate-900">5</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">Services</div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <div className="text-2xl font-bold text-slate-900">∞</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">Tenants</div>
              </div>
            </div>
          </div>

          {/* Auth card */}
          <Card className="shadow-xl border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Sign in to dashboard</CardTitle>
              {hasUsers === false && (
                <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <div className="font-medium mb-1">First time here?</div>
                  <button
                    onClick={handleSeed}
                    disabled={loading}
                    className="text-amber-900 underline hover:text-amber-700"
                  >
                    Click here to seed demo data
                  </button>
                  <span className="text-amber-700"> — creates an admin user, project, API key, and sample data.</span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register')}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="login">Sign in</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs text-slate-600">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@ucp.local"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs text-slate-600">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                  <Button onClick={handleLogin} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Sign in
                  </Button>
                </TabsContent>

                <TabsContent value="register" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs text-slate-600">Name (optional)</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email-r" className="text-xs text-slate-600">Email</Label>
                    <Input
                      id="email-r"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password-r" className="text-xs text-slate-600">Password (min 8 chars)</Label>
                    <Input
                      id="password-r"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tenant" className="text-xs text-slate-600">Organization name (optional)</Label>
                    <Input
                      id="tenant"
                      type="text"
                      placeholder="Acme Inc."
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleRegister} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create account
                  </Button>
                  <p className="text-xs text-slate-500 text-center">
                    First registered user becomes <strong>super_admin</strong>.
                  </p>
                </TabsContent>
              </Tabs>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-start gap-2 text-xs text-slate-500">
                  <Radio className="w-3 h-3 mt-0.5 flex-shrink-0 text-emerald-500" />
                  <div>
                    <strong className="text-slate-700">Realtime Gateway</strong> running on port 3003.
                    Push-based delivery via Socket.io — no polling.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-8 py-4 text-center text-xs text-slate-400">
        Built with Next.js · Prisma · Socket.io · TypeScript
      </footer>
    </div>
  )
}
