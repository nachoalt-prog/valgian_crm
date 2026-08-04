"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TipoTramiteDialog } from "@/components/tipo-tramite-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { TipoTramiteInput } from "@valgian/core";
import type { TipoTramiteRow, OpcionSimple } from "@/components/tipos-tramite-admin-tool";

interface TiposTramiteAdminPanelProps {
  tipos: TipoTramiteRow[];
  categorias: OpcionSimple[];
  estrategias: OpcionSimple[];
  entidades: OpcionSimple[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canGestionar: boolean;
  onSinPermiso: () => void;
  onSave: (data: TipoTramiteInput, id?: string) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function TiposTramiteAdminPanel({
  tipos,
  categorias,
  estrategias,
  entidades,
  selectedId,
  onSelect,
  canGestionar,
  onSinPermiso,
  onSave,
  onDelete,
}: TiposTramiteAdminPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TipoTramiteRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TipoTramiteRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(t: TipoTramiteRow) {
    if (!canGestionar) return onSinPermiso();
    setEditing(t);
    setDialogOpen(true);
  }

  function pedirBorrado(t: TipoTramiteRow) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(t);
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
          <ClipboardList className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Tipos de Trámite</h2>
        </div>
        <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {tipos.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Sin tipos de trámite. Creá el primero.</li>}
        {tipos.map((t) => {
          const isSelected = selectedId === t.id;
          const categoria = categorias.find((c) => c.id === t.idCategoria);
          return (
            <li
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`group flex cursor-pointer items-center justify-between border-l-2 px-5 py-3.5 transition-colors ${
                isSelected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/60"
              }`}
            >
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">[{t.codigo}]</span>
                  {categoria && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {categoria.nombre}
                    </Badge>
                  )}
                </div>
                <span className="truncate text-sm font-medium text-foreground">{t.nombre}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicion(t);
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
                    pedirBorrado(t);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <TipoTramiteDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tipo={editing}
        categorias={categorias}
        estrategias={estrategias}
        entidades={entidades}
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
        title="Eliminar Tipo de Trámite"
        description={deleteError ?? `¿Eliminás "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
