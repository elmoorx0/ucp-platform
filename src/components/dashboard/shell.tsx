'use client'

import { useState, type ReactNode } from 'react'
import { Project, User, ViewKey } from '@/app/page'
import {
  LayoutDashboard, FolderKanban, KeyRound, Bell, Send, Settings, Users, Radio, FileClock, ScrollText, LogOut, Plus, ChevronDown, Check
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface NavItem {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  requiresProject?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, requiresProject: true },
  { key: 'projects', label: 'Projects', icon: FolderKanban },
  { key: 'api-keys', label: 'API Keys', icon: KeyRound, requiresProject: true },
  { key: 'notifications', label: 'Notifications', icon: Bell, requiresProject: true },
  { key: 'send', label: 'Send', icon: Send, requiresProject: true },
  { key: 'providers', label: 'Providers', icon: Settings, requiresProject: true },
  { key: 'endusers', label: 'End Users', icon: Users, requiresProject: true },
  { key: 'events', label: 'Events', icon: Radio, requiresProject: true },
  { key: 'realtime', label: 'Realtime', icon: FileClock, requiresProject: true },
  { key: 'audit', label: 'Audit Log', icon: ScrollText },
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
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-bold text-white text-sm">U</div>
            <div>
              <div className="text-white font-semibold text-sm leading-tight">UCP Platform</div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wider">Communication as a Service</div>
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
                onClick={() => !disabled && onViewChange(item.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left',
                  active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
                  disabled && 'opacity-40 cursor-not-allowed'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.key === 'realtime' && (
                  <span className={cn('w-1.5 h-1.5 rounded-full', socketConnected ? 'bg-emerald-400' : 'bg-slate-600')} />
                )}
              </button>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-slate-500">
            <div>v1.0.0 · Multi-Tenant</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Project selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100 text-sm font-medium text-slate-700">
                  <FolderKanban className="w-4 h-4 text-slate-500" />
                  <span>{currentProject ? currentProject.name : 'Select project'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="text-xs text-slate-500">Projects</DropdownMenuLabel>
                {projects.length === 0 && (
                  <div className="px-3 py-4 text-sm text-slate-400 text-center">No projects yet</div>
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
                  <Plus className="w-4 h-4 mr-2" />
                  Manage projects
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {currentProject && (
              <Badge variant="outline" className="text-xs text-slate-600">
                {currentProject.status}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={cn('w-1.5 h-1.5 rounded-full', socketConnected ? 'bg-emerald-400' : 'bg-slate-300')} />
              {socketConnected ? 'Realtime connected' : 'Realtime idle'}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="text-xs bg-slate-200 text-slate-700">
                      {(user.name || user.email)[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <div className="text-xs font-medium text-slate-700 leading-tight">{user.name || user.email}</div>
                    <div className="text-[10px] text-slate-400 leading-tight uppercase tracking-wide">{user.role}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">
                  <div className="font-medium">{user.email}</div>
                  <div className="text-slate-400">Role: {user.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
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
