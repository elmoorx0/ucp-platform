'use client'

import { useState, type ReactNode } from 'react'
import { Project, User, ViewKey } from '@/app/page'
import {
  LayoutDashboard, FolderKanban, KeyRound, Bell, Send, Settings, Users, Radio, FileClock, ScrollText, LogOut, Plus, ChevronDown, Check, Menu, X
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface NavItem {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  requiresProject?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: 'نظرة عامة', icon: LayoutDashboard, requiresProject: true },
  { key: 'projects', label: 'المشاريع', icon: FolderKanban },
  { key: 'api-keys', label: 'مفاتيح API', icon: KeyRound, requiresProject: true },
  { key: 'notifications', label: 'الإشعارات', icon: Bell, requiresProject: true },
  { key: 'send', label: 'إرسال', icon: Send, requiresProject: true },
  { key: 'providers', label: 'المزودون', icon: Settings, requiresProject: true },
  { key: 'endusers', label: 'المستخدمون', icon: Users, requiresProject: true },
  { key: 'events', label: 'الأحداث', icon: Radio, requiresProject: true },
  { key: 'realtime', label: 'الوقت الحقيقي', icon: FileClock, requiresProject: true },
  { key: 'audit', label: 'سجل التدقيق', icon: ScrollText },
]

interface ShellProps {
  user: User
  projects: Project[]
  currentProject: Project | null
  onSelectProject: (id: string) => void
  onRefreshProjects: () => void
  view: ViewKey
  onViewChange: (v: ViewKey) => void
  onLogout: () => void
  socketConnected: boolean
  children: ReactNode
}

export function DashboardShell({
  user, projects, currentProject, onSelectProject, onRefreshProjects, view, onViewChange, onLogout, socketConnected, children
}: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebarContent = (onNavigate?: () => void) => (
    <>
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-bold text-white text-base shadow-lg shadow-emerald-500/20">U</div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm leading-tight">منصة UCP</div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider">منصة الاتصالات الموحدة</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = view === item.key
          const disabled = item.requiresProject && !currentProject
          return (
            <button
              key={item.key}
              onClick={() => {
                if (!disabled) {
                  onViewChange(item.key)
                  onNavigate?.()
                }
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-right',
                active
                  ? 'bg-sidebar-accent text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:bg-sidebar-accent/50 hover:text-slate-200',
                disabled && 'opacity-40 cursor-not-allowed'
              )}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.key === 'realtime' && (
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700')} />
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] text-slate-600">الإصدار 1.6.0</span>
          <Badge variant="secondary" className="text-[9px] bg-slate-800 text-slate-400 border-0">متعدد المستأجرين</Badge>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-sidebar text-sidebar-foreground flex-col flex-shrink-0">
        {sidebarContent()}
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-0">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
              <span className="text-white font-bold text-sm">القائمة</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 flex flex-col">
              {sidebarContent(() => setMobileOpen(false))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile menu button */}
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>

            {/* Project selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 text-sm font-medium text-slate-700 transition-colors">
                  <FolderKanban className="w-4 h-4 text-slate-400" />
                  <span className="hidden sm:inline max-w-[150px] truncate">{currentProject ? currentProject.name : 'اختر مشروعاً'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="text-xs text-slate-500">المشاريع</DropdownMenuLabel>
                {projects.length === 0 && (
                  <div className="px-3 py-4 text-sm text-slate-400 text-center">لا توجد مشاريع بعد</div>
                )}
                {projects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="text-xs text-slate-400">/{p.slug}</span>
                    </div>
                    {currentProject?.id === p.id && <Check className="w-4 h-4 text-emerald-500" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onViewChange('projects')} className="cursor-pointer">
                  <Plus className="w-4 h-4 ml-2" />
                  إدارة المشاريع
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {currentProject && (
              <Badge variant="outline" className="text-xs text-slate-600 hidden sm:inline-flex">
                {currentProject.status === 'active' ? 'نشط' : currentProject.status}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <span className={cn('w-2 h-2 rounded-full', socketConnected ? 'bg-emerald-400' : 'bg-slate-300')} />
              <span className="hidden md:inline">{socketConnected ? 'متصل بالوقت الحقيقي' : 'الوقت الحقيقي متوقف'}</span>
            </div>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700 font-medium">
                      {(user.name || user.email)[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-right hidden md:block">
                    <div className="text-xs font-medium text-slate-700 leading-tight">{user.name || user.email}</div>
                    <div className="text-[10px] text-slate-400 leading-tight">{user.role === 'super_admin' ? 'مدير عام' : user.role}</div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">
                  <div className="font-medium">{user.email}</div>
                  <div className="text-slate-400">الدور: {user.role === 'super_admin' ? 'مدير عام' : user.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600">
                  <LogOut className="w-4 h-4 ml-2" />
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
