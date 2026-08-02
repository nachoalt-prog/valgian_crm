"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReporteDialog } from "@/components/reporte-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { ReporteInput } from "@valgian/core";

interface ReporteRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  idCategoria: string | null;
  query: string | null;
  columnas: unknown;
}

interface CategoriaOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface ReportesAdminPanelProps {
  reportes: ReporteRow[];
  categorias: CategoriaOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canGestionar: boolean;
  onSinPermiso: () => void;
  onSave: (data: ReporteInput, id?: string) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function ReportesAdminPanel({ reportes, categorias, selectedId, onSelect, canGestionar, onSinPermiso, onSave, onDelete }: ReportesAdminPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ReporteRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ReporteRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(r: ReporteRow) {
    if (!canGestionar) return onSinPermiso();
    setEditing(r);
    setDialogOpen(true);
  }

  function pedirBorrado(r: ReporteRow) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(r);
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
          <BarChart3 className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Reportes</h2>
        </div>
        <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {reportes.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-muted-foreground">Sin reportes. Creá el primero.</li>
        )}
        {reportes.map((r) => {
          const isSelected = selectedId === r.id;
          const categoria = categorias.find((c) => c.id === r.idCategoria);
          return (
            <li
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`group flex cursor-pointer items-center justify-between border-l-2 px-5 py-3.5 transition-colors ${
                isSelected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/60"
              }`}
            >
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">[{r.codigo}]</span>
                  {categoria && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {categoria.nombre}
                    </Badge>
                  )}
                </div>
                <span className="truncate text-sm font-medium text-foreground">{r.nombre}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicion(r);
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
                    pedirBorrado(r);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <ReporteDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} reporte={editing} categorias={categorias} onSave={onSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Reporte"
        description={deleteError ?? `¿Eliminás el reporte "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
