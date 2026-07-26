"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BandejaDialog } from "@/components/bandeja-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { BandejaInput } from "@valgian/core";

interface BandejaRow {
  id: string;
  codigo: string;
  nombre: string;
  query: string | null;
  columnas: unknown;
  idLayout: string | null;
}

interface LayoutOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface BandejasAdminPanelProps {
  bandejas: BandejaRow[];
  layoutsDisponibles: LayoutOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canGestionar: boolean;
  onSinPermiso: () => void;
  onSave: (data: BandejaInput, id?: string) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function BandejasAdminPanel({
  bandejas,
  layoutsDisponibles,
  selectedId,
  onSelect,
  canGestionar,
  onSinPermiso,
  onSave,
  onDelete,
}: BandejasAdminPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BandejaRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<BandejaRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(b: BandejaRow) {
    if (!canGestionar) return onSinPermiso();
    setEditing(b);
    setDialogOpen(true);
  }

  function pedirBorrado(b: BandejaRow) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(b);
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
          <Inbox className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Bandejas</h2>
        </div>
        <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
          <PlusCircle className="size-3.5" />
          Nueva
        </Button>
      </div>

      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {bandejas.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-muted-foreground">Sin bandejas. Creá la primera.</li>
        )}
        {bandejas.map((b) => {
          const isSelected = selectedId === b.id;
          return (
            <li
              key={b.id}
              onClick={() => onSelect(b.id)}
              className={`group flex cursor-pointer items-center justify-between border-l-2 px-5 py-3.5 transition-colors ${
                isSelected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/60"
              }`}
            >
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">[{b.codigo}]</span>
                </div>
                <span className="truncate text-sm font-medium text-foreground">{b.nombre}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicion(b);
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
                    pedirBorrado(b);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <BandejaDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bandeja={editing}
        layoutsDisponibles={layoutsDisponibles}
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
        title="Eliminar Bandeja"
        description={deleteError ?? `¿Eliminás la bandeja "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
