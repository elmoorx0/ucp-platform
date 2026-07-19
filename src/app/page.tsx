'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { api } from '@/lib/dashboard-api'
import { LoginView } from '@/components/dashboard/login-view'
import { DashboardShell } from '@/components/dashboard/shell'
import { OverviewView } from '@/components/dashboard/overview-view'
import { ProjectsView } from '@/components/dashboard/projects-view'
import { ApiKeysView } from '@/components/dashboard/api-keys-view'
import { NotificationsView } from '@/components/dashboard/notifications-view'
import { SendNotificationView } from '@/components/dashboard/send-notification-view'
import { ProvidersView } from '@/components/dashboard/providers-view'
import { EndUsersView } from '@/components/dashboard/end-users-view'
import { EventsView } from '@/components/dashboard/events-view'
import { AuditView } from '@/components/dashboard/audit-view'
import { RealtimeMonitorView } from '@/components/dashboard/realtime-monitor-view'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

export type ViewKey =
  | 'overview'
  | 'projects'
  | 'api-keys'
  | 'notifications'
  | 'send'
  | 'providers'
  | 'endusers'
  | 'events'
  | 'audit'
  | 'realtime'

export interface User {
  userId: string
  email: string
  name?: string
  role: string
  tenantId?: string
}

export interface Project {
  id: string
  name: string
  slug: string
  description?: string | null
  status: string
  createdAt: string
  _count?: { apiKeys: number; endUsers: number; devices: number; notifications: number }
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [view, setView] = useState<ViewKey>('overview')
  const [socket, setSocket] = useState<Socket | null>(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [socketLogs, setSocketLogs] = useState<Array<{ id: string; type: string; message: string; timestamp: number }>>([])

  // ============ Check auth on mount ============
  useEffect(() => {
    api.me()
      .then((u) => {
        setUser({ userId: u.userId, email: u.email, name: u.name, role: u.role, tenantId: u.tenantId })
      })
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true))
  }, [])

  // ============ Load projects when user changes ============
  useEffect(() => {
    if (!user) return
    let cancelled = false
    api.listProjects()
      .then((ps) => {
        if (cancelled) return
        setProjects(ps as Project[])
        if (ps.length > 0 && !currentProjectId) {
          setCurrentProjectId(ps[0].id)
        }
      })
      .catch(() => {
        // ignore
      })
    return () => { cancelled = true }
  }, [user])

  const currentProject = projects.find((p) => p.id === currentProjectId) || null

  // ============ Socket connection ============
  const addSocketLog = useCallback((type: string, message: string) => {
    setSocketLogs((prev) => {
      const next = [...prev, { id: Math.random().toString(36).slice(2), type, message, timestamp: Date.now() }]
      // Keep only last 100
      if (next.length > 100) return next.slice(next.length - 100)
      return next
    })
  }, [])

  useEffect(() => {
    if (!currentProject) {
      // Just disconnect if we have a socket — defer setState outside effect body
      if (socket) {
        const s = socket
        s.disconnect()
      }
      return
    }
    // Get the first API key for this project to use for socket auth
    api.listApiKeys(currentProject.id).then((keys) => {
      const activeKey = keys.find((k) => k.status === 'active')
      if (!activeKey) {
        addSocketLog('warning', 'No active API key for socket connection. Create one in API Keys.')
        return
      }
      addSocketLog('warning', 'Socket.io auth requires API key plaintext (not available in dashboard). Realtime monitor is in "observer" mode — no live data.')
    }).catch(() => {})
  }, [currentProject, socket, addSocketLog])

  const refreshProjects = useCallback(async () => {
    if (!user) return
    try {
      const ps = (await api.listProjects()) as Project[]
      setProjects(ps)
    } catch (e) {
      toast.error('Failed to load projects: ' + (e as Error).message)
    }
  }, [user])

  // ============ Render ============
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">Loading UCP Dashboard…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <LoginView
          onLogin={(u) => setUser(u)}
          onRegister={async (email, password, name, tenantName) => {
            const res = await api.register(email, password, name, tenantName)
            const me = await api.me()
            setUser({ userId: me.userId, email: me.email, name: me.name, role: me.role, tenantId: me.tenantId })
            toast.success(res.isFirstUser ? 'Welcome! You are the super admin.' : 'Account created. Welcome!')
          }}
          onSeed={async () => {
            const res = await api.seed(true)
            toast.success('Demo data seeded!')
            return res
          }}
        />
        <Toaster richColors closeButton position="top-right" />
      </>
    )
  }

  return (
    <>
      <DashboardShell
        user={user}
        projects={projects}
        currentProject={currentProject}
        onSelectProject={setCurrentProjectId}
        onRefreshProjects={refreshProjects}
        view={view}
        onViewChange={setView}
        onLogout={async () => {
          await api.logout()
          setUser(null)
        }}
        socketConnected={socketConnected}
      >
        {view === 'overview' && currentProject && (
          <OverviewView project={currentProject} />
        )}
        {view === 'projects' && (
          <ProjectsView
            projects={projects}
            currentProjectId={currentProjectId}
            onSelect={setCurrentProjectId}
            onRefresh={refreshProjects}
          />
        )}
        {view === 'api-keys' && currentProject && (
          <ApiKeysView project={currentProject} />
        )}
        {view === 'notifications' && currentProject && (
          <NotificationsView project={currentProject} />
        )}
        {view === 'send' && currentProject && (
          <SendNotificationView project={currentProject} />
        )}
        {view === 'providers' && currentProject && (
          <ProvidersView project={currentProject} />
        )}
        {view === 'endusers' && currentProject && (
          <EndUsersView project={currentProject} />
        )}
        {view === 'events' && currentProject && (
          <EventsView project={currentProject} />
        )}
        {view === 'audit' && <AuditView />}
        {view === 'realtime' && currentProject && (
          <RealtimeMonitorView project={currentProject} logs={socketLogs} onClearLogs={() => setSocketLogs([])} />
        )}
        {!currentProject && view !== 'projects' && view !== 'audit' && (
          <div className="flex flex-col items-center justify-center h-full py-20">
            <div className="text-slate-400 text-sm">No project selected</div>
            <button
              className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-md text-sm"
              onClick={() => setView('projects')}
            >
              Select or create a project
            </button>
          </div>
        )}
      </DashboardShell>
      <Toaster richColors closeButton position="top-right" />
    </>
  )
}
