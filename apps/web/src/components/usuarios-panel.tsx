"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, Users, User, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UsuarioDialog } from "@/components/usuario-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { PerfilConContador, UsuarioConPerfil } from "@valgian/core";

interface UsuariosPanelProps {
  perfiles: PerfilConContador[];
  usuarios: UsuarioConPerfil[];
  selectedPerfilId: string | null;
  canGestionar: boolean;
  onSinPermiso: () => void;
  onSave: (
    data: { idPerfil: string | null; username: string; password?: string; avatarPath: string | null },
    id?: string,
  ) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function UsuariosPanel({
  perfiles,
  usuarios,
  selectedPerfilId,
  canGestionar,
  onSinPermiso,
  onSave,
  onDelete,
}: UsuariosPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<UsuarioConPerfil | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UsuarioConPerfil | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const selectedPerfil = perfiles.find((p) => p.id === selectedPerfilId);

  const filtered = usuarios
    .filter((u) => (selectedPerfilId ? u.idPerfil === selectedPerfilId : true))
    .filter((u) => (search.trim() === "" ? true : u.username.toLowerCase().includes(search.toLowerCase())));

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditingUsuario(null);
    setDialogOpen(true);
  }

  function abrirEdicion(u: UsuarioConPerfil) {
    if (!canGestionar) return onSinPermiso();
    setEditingUsuario(u);
    setDialogOpen(true);
  }

  function pedirBorrado(u: UsuarioConPerfil) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(u);
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await onDelete(deleteConfirm.id);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteConfirm(null);
  }

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="size-4 shrink-0 text-accent" />
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-accent">Usuarios</h2>
            {selectedPerfil && (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono text-primary">[{selectedPerfil.codigo}]</span> {selectedPerfil.nombre}
                </span>
              </>
            )}
          </div>
        </div>
        <Button size="sm" onClick={abrirNuevo} className="h-8 shrink-0 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 text-xs">
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      <div className="border-b border-border px-5 py-3">
        <Input placeholder="Buscar por username…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" />
      </div>

      {!selectedPerfilId && (
        <div className="border-b border-border bg-muted/30 px-5 py-2.5">
          <p className="text-xs text-muted-foreground">Mostrando todos los usuarios. Seleccioná un perfil para filtrar.</p>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <User className="size-8 opacity-30" />
            <p className="text-sm">Sin usuarios{selectedPerfilId ? " en este perfil" : ""}.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead className="hidden md:table-cell">Perfil</TableHead>
                <TableHead className="hidden lg:table-cell">Token</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const hasToken = !!u.token;
                return (
                  <TableRow key={u.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/20">
                          <span className="text-xs font-bold uppercase text-accent">{u.username.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-foreground">{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.perfilCodigo ? (
                        <Badge variant="outline" className="border-primary/40 bg-primary/10 font-mono text-[10px] text-primary">
                          [{u.perfilCodigo}] {u.perfilNombre}
                        </Badge>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">Sin perfil</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge
                        variant={hasToken ? "default" : "secondary"}
                        className={`h-4 px-1.5 text-[10px] ${hasToken ? "border-primary/30 bg-primary/20 text-primary" : ""}`}
                      >
                        {hasToken ? "Con token" : "Sin token"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-accent" onClick={() => abrirEdicion(u)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(u)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-2.5">
        <span className="text-xs text-muted-foreground">
          {filtered.length} usuario{filtered.length !== 1 ? "s" : ""}
          {selectedPerfilId ? " en este perfil" : " en total"}
        </span>
      </div>

      <UsuarioDialog
        key={`${editingUsuario?.id ?? "new"}-${selectedPerfilId ?? "none"}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        usuario={editingUsuario}
        perfiles={perfiles}
        defaultPerfilId={selectedPerfilId}
        onSave={onSave}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Usuario"
        description={deleteError ?? `¿Eliminás el usuario "${deleteConfirm?.username}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
