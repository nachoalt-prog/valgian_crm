"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LayoutLegajoDialog } from "@/components/layout-legajo-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { LayoutLegajoInput } from "@valgian/core";

interface LayoutRow {
  id: string;
  codigo: string;
  nombre: string;
}

interface LayoutsLegajoPanelProps {
  layouts: LayoutRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canGestionar: boolean;
  onSinPermiso: () => void;
  onSave: (data: LayoutLegajoInput, id?: string) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function LayoutsLegajoPanel({ layouts, selectedId, onSelect, canGestionar, onSinPermiso, onSave, onDelete }: LayoutsLegajoPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LayoutRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LayoutRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(l: LayoutRow) {
    if (!canGestionar) return onSinPermiso();
    setEditing(l);
    setDialogOpen(true);
  }

  function pedirBorrado(l: LayoutRow) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(l);
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
          <LayoutTemplate className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Layouts</h2>
        </div>
        <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {layouts.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Sin layouts. Creá el primero.</li>}
        {layouts.map((l) => {
          const isSelected = selectedId === l.id;
          return (
            <li
              key={l.id}
              onClick={() => onSelect(l.id)}
              className={`group flex cursor-pointer items-center justify-between border-l-2 px-5 py-3.5 transition-colors ${
                isSelected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/60"
              }`}
            >
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">[{l.codigo}]</span>
                </div>
                <span className="truncate text-sm font-medium text-foreground">{l.nombre}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicion(l);
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
                    pedirBorrado(l);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <LayoutLegajoDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} layout={editing} onSave={onSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Layout"
        description={deleteError ?? `¿Eliminás el layout "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
