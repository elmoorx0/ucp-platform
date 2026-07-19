'use client'

import { useState } from 'react'
import { api } from '@/lib/dashboard-api'
import { Project } from '@/app/page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, FolderKanban, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  projects: Project[]
  currentProjectId: string | null
  onSelect: (id: string) => void
  onRefresh: () => void
}

export function ProjectsView({ projects, currentProjectId, onSelect, onRefresh }: Props) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!newName) return
    setLoading(true)
    try {
      await api.createProject(newName, newDesc || undefined)
      toast.success(`Project "${newName}" created`)
      setNewName('')
      setNewDesc('')
      setCreating(false)
      onRefresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">Each project is an isolated workspace with its own API keys and providers.</p>
        </div>
        <Button onClick={() => setCreating(!creating)} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {creating && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Create new project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Awesome App" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Description (optional)</Label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Production mobile app" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={loading || !newName}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <div className="text-sm text-slate-500 mb-1">No projects yet</div>
              <div className="text-xs text-slate-400">Create your first project to get started</div>
            </CardContent>
          </Card>
        )}
        {projects.map((p) => (
          <Card
            key={p.id}
            className={`cursor-pointer transition-all hover:shadow-md ${currentProjectId === p.id ? 'ring-2 ring-emerald-400' : ''}`}
            onClick={() => onSelect(p.id)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-semibold text-sm">
                  {p.name[0].toUpperCase()}
                </div>
                <Badge variant="outline" className="text-xs capitalize">{p.status}</Badge>
              </div>
              <div className="font-semibold text-slate-900 text-sm">{p.name}</div>
              <div className="text-xs text-slate-400 mb-3">/{p.slug}</div>
              {p.description && <div className="text-xs text-slate-500 mb-3 line-clamp-2">{p.description}</div>}
              <div className="flex items-center gap-3 text-xs text-slate-500 pt-3 border-t border-slate-100">
                <span>{p._count?.apiKeys || 0} keys</span>
                <span>·</span>
                <span>{p._count?.endUsers || 0} users</span>
                <span>·</span>
                <span>{p._count?.notifications || 0} notifs</span>
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Created {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
