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
import { arSA } from 'date-fns/locale'

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
      toast.success(`تم إنشاء المشروع "${newName}"`)
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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">المشاريع</h1>
          <p className="text-sm text-slate-500">كل مشروع مساحة عمل معزولة بمفاتيح API ومزودين خاصين.</p>
        </div>
        <Button onClick={() => setCreating(!creating)} className="bg-slate-900 hover:bg-slate-800 flex-shrink-0">
          <Plus className="w-4 h-4 ml-2" />
          <span className="hidden sm:inline">مشروع جديد</span>
          <span className="sm:hidden">جديد</span>
        </Button>
      </div>

      {creating && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">إنشاء مشروع جديد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">الاسم</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="تطبيقي الرائع" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">الوصف (اختياري)</Label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="تطبيق الإنتاج للجوال" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreating(false)}>إلغاء</Button>
              <Button onClick={handleCreate} disabled={loading || !newName}>
                {loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                إنشاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <FolderKanban className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <div className="text-sm text-slate-500 mb-1">لا توجد مشاريع بعد</div>
              <div className="text-xs text-slate-400">أنشئ مشروعك الأول للبدء</div>
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
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-bold text-sm">
                  {p.name[0].toUpperCase()}
                </div>
                <Badge variant="outline" className="text-xs">{p.status === 'active' ? 'نشط' : p.status}</Badge>
              </div>
              <div className="font-semibold text-slate-900 text-sm">{p.name}</div>
              <div className="text-xs text-slate-400 mb-3">/{p.slug}</div>
              {p.description && <div className="text-xs text-slate-500 mb-3 line-clamp-2">{p.description}</div>}
              <div className="flex items-center gap-2 text-xs text-slate-500 pt-3 border-t border-slate-100 flex-wrap">
                <span>{p._count?.apiKeys || 0} مفتاح</span>
                <span>·</span>
                <span>{p._count?.endUsers || 0} مستخدم</span>
                <span>·</span>
                <span>{p._count?.notifications || 0} إشعار</span>
              </div>
              <div className="text-xs text-slate-400 mt-2">
                {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true, locale: arSA })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
