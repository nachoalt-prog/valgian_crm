'use client'

import { useState } from 'react'
import { PlusCircle, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PerfilDialog } from '@/components/perfil-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Perfil, PerfilFormData } from '@/lib/types'

interface PerfilesPanelProps {
  perfiles: Perfil[]
  selectedPerfilId: string | null
  onSelectPerfil: (id: string) => void
  onAdd: (data: PerfilFormData) => void
  onEdit: (data: PerfilFormData, id: string) => void
  onDelete: (id: string) => void
  usuariosCount: (perfilId: string) => number
}

export function PerfilesPanel({
  perfiles,
  selectedPerfilId,
  onSelectPerfil,
  onAdd,
  onEdit,
  onDelete,
  usuariosCount,
}: PerfilesPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPerfil, setEditingPerfil] = useState<Perfil | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Perfil | null>(null)

  const handleSave = (data: PerfilFormData, id?: string) => {
    if (id) onEdit(data, id)
    else onAdd(data)
  }

  return (
    <section className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm uppercase tracking-widest text-primary">Perfiles</h2>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingPerfil(null); setDialogOpen(true) }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 text-xs h-8"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Nuevo
        </Button>
      </div>

      {/* List */}
      <ul className="flex-1 overflow-y-auto divide-y divide-border">
        {perfiles.length === 0 && (
          <li className="px-5 py-10 text-center text-muted-foreground text-sm">
            Sin perfiles. Creá el primero.
          </li>
        )}
        {perfiles.map((p) => {
          const count = usuariosCount(p.id)
          const isSelected = selectedPerfilId === p.id
          return (
            <li
              key={p.id}
              onClick={() => onSelectPerfil(p.id)}
              className={`
                flex items-center justify-between px-5 py-3.5 cursor-pointer
                transition-colors group
                ${isSelected
                  ? 'bg-primary/10 border-l-2 border-l-primary'
                  : 'hover:bg-muted/60 border-l-2 border-l-transparent'
                }
              `}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs text-primary font-bold">[{p.codigo}]</span>
                  <span className="text-sm text-foreground font-medium truncate">{p.nombre}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-4 px-1.5 bg-muted text-muted-foreground"
                  >
                    {count} usuario{count !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingPerfil(p)
                    setDialogOpen(true)
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteConfirm(p)
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <PerfilDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        perfil={editingPerfil}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => !o && setDeleteConfirm(null)}
        title="Eliminar Perfil"
        description={`¿Eliminás el perfil "${deleteConfirm?.nombre}"? También se desvincularán sus usuarios.`}
        onConfirm={() => {
          if (deleteConfirm) onDelete(deleteConfirm.id)
          setDeleteConfirm(null)
        }}
      />
    </section>
  )
}
