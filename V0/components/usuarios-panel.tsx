'use client'

import { useState } from 'react'
import { PlusCircle, Pencil, Trash2, Users, User, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { UsuarioDialog } from '@/components/usuario-dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Perfil, Usuario, UsuarioFormData } from '@/lib/types'

interface UsuariosPanelProps {
  perfiles: Perfil[]
  usuarios: Usuario[]
  selectedPerfilId: string | null
  onAdd: (data: UsuarioFormData) => void
  onEdit: (data: UsuarioFormData, id: string) => void
  onDelete: (id: string) => void
}

export function UsuariosPanel({
  perfiles,
  usuarios,
  selectedPerfilId,
  onAdd,
  onEdit,
  onDelete,
}: UsuariosPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Usuario | null>(null)
  const [search, setSearch] = useState('')

  const selectedPerfil = perfiles.find((p) => p.id === selectedPerfilId)

  const filtered = usuarios
    .filter((u) => (selectedPerfilId ? u.idPerfil === selectedPerfilId : true))
    .filter((u) =>
      search.trim() === ''
        ? true
        : u.username.toLowerCase().includes(search.toLowerCase())
    )

  const handleSave = (data: UsuarioFormData, id?: string) => {
    if (id) onEdit(data, id)
    else onAdd(data)
  }

  const getPerfilLabel = (perfilId: string | null) => {
    if (!perfilId) return null
    const p = perfiles.find((x) => x.id === perfilId)
    return p ? `[${p.codigo}] ${p.nombre}` : null
  }

  return (
    <section className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-accent shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="font-semibold text-sm uppercase tracking-widest text-accent">Usuarios</h2>
            {selectedPerfil && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate">
                  <span className="font-mono text-primary">[{selectedPerfil.codigo}]</span>{' '}
                  {selectedPerfil.nombre}
                </span>
              </>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditingUsuario(null); setDialogOpen(true) }}
          className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5 text-xs h-8 shrink-0"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Nuevo
        </Button>
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b border-border">
        <Input
          placeholder="Buscar por username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm bg-muted border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Subheader info */}
      {!selectedPerfilId && (
        <div className="px-5 py-2.5 bg-muted/30 border-b border-border">
          <p className="text-xs text-muted-foreground">
            Mostrando todos los usuarios. Seleccioná un perfil para filtrar.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            <User className="w-8 h-8 opacity-30" />
            <p className="text-sm">Sin usuarios{selectedPerfilId ? ' en este perfil' : ''}.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-5 py-3 font-medium">Username</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Perfil</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Token</th>
                <th className="text-right px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => {
                const perfilLabel = getPerfilLabel(u.idPerfil)
                const hasToken = !!u.token
                return (
                  <tr key={u.id} className="group hover:bg-muted/40 transition-colors">
                    {/* Username + avatar */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
                          <span className="text-accent text-xs font-bold uppercase">
                            {u.username.charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium text-foreground">{u.username}</span>
                      </div>
                    </td>

                    {/* Perfil badge */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      {perfilLabel ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-primary/40 text-primary bg-primary/10 font-mono"
                        >
                          {perfilLabel}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Sin perfil</span>
                      )}
                    </td>

                    {/* Token status */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <Badge
                        variant={hasToken ? 'default' : 'secondary'}
                        className={`text-[10px] h-4 px-1.5 ${
                          hasToken
                            ? 'bg-primary/20 text-primary border-primary/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {hasToken ? 'Con token' : 'Sin token'}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-accent"
                          onClick={() => {
                            setEditingUsuario(u)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteConfirm(u)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer count */}
      <div className="px-5 py-2.5 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filtered.length} usuario{filtered.length !== 1 ? 's' : ''}
          {selectedPerfilId ? ' en este perfil' : ' en total'}
        </span>
      </div>

      <UsuarioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        usuario={editingUsuario}
        perfiles={perfiles}
        defaultPerfilId={selectedPerfilId}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => !o && setDeleteConfirm(null)}
        title="Eliminar Usuario"
        description={`¿Eliminás el usuario "${deleteConfirm?.username}"? Esta acción no se puede deshacer.`}
        onConfirm={() => {
          if (deleteConfirm) onDelete(deleteConfirm.id)
          setDeleteConfirm(null)
        }}
      />
    </section>
  )
}
