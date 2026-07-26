"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PerfilDialog } from "@/components/perfil-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { PerfilConContador } from "@valgian/core";

interface InterfazOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface PerfilesPanelProps {
  perfiles: PerfilConContador[];
  selectedPerfilId: string | null;
  onSelectPerfil: (id: string) => void;
  canGestionar: boolean;
  onSinPermiso: () => void;
  interfaces: InterfazOption[];
  onSave: (
    data: { codigo: string; nombre: string; idInterfaz: string | null },
    id?: string,
  ) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function PerfilesPanel({
  perfiles,
  selectedPerfilId,
  onSelectPerfil,
  canGestionar,
  onSinPermiso,
  interfaces,
  onSave,
  onDelete,
}: PerfilesPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<PerfilConContador | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PerfilConContador | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditingPerfil(null);
    setDialogOpen(true);
  }

  function abrirEdicion(p: PerfilConContador) {
    if (!canGestionar) return onSinPermiso();
    setEditingPerfil(p);
    setDialogOpen(true);
  }

  function pedirBorrado(p: PerfilConContador) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(p);
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
    <section className="flex h-full flex-col bg-card/50">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Perfiles</h2>
        </div>
        <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {perfiles.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-muted-foreground">Sin perfiles. Creá el primero.</li>
        )}
        {perfiles.map((p) => {
          const isSelected = selectedPerfilId === p.id;
          return (
            <li
              key={p.id}
              onClick={() => onSelectPerfil(p.id)}
              className={`group flex cursor-pointer items-center justify-between border-l-2 px-5 py-3.5 transition-colors ${
                isSelected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/60"
              }`}
            >
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">[{p.codigo}]</span>
                  <span className="truncate text-sm font-medium text-foreground">{p.nombre}</span>
                </div>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {p.usuariosCount} usuario{p.usuariosCount !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicion(p);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    pedirBorrado(p);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <PerfilDialog
        key={editingPerfil?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        perfil={editingPerfil}
        interfaces={interfaces}
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
        title="Eliminar Perfil"
        description={
          deleteError ?? `¿Eliminás el perfil "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`
        }
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
