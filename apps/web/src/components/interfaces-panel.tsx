"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InterfazDialog } from "@/components/interfaz-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface InterfazRow {
  id: string;
  codigo: string;
  nombre: string;
  fuente: string | null;
  colorPrimario: string | null;
  colorSecundario: string | null;
  titulo: string | null;
  imagenFondo: string | null;
}

interface InterfacesPanelProps {
  interfaces: InterfazRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  canGestionar: boolean;
  onSinPermiso: () => void;
  onSave: (
    data: {
      codigo: string;
      nombre: string;
      fuente: string | null;
      colorPrimario: string | null;
      colorSecundario: string | null;
      titulo: string | null;
      imagenFondo: string | null;
    },
    id?: string,
  ) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function InterfacesPanel({
  interfaces,
  selectedId,
  onSelect,
  canGestionar,
  onSinPermiso,
  onSave,
  onDelete,
}: InterfacesPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InterfazRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<InterfazRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(i: InterfazRow) {
    if (!canGestionar) return onSinPermiso();
    setEditing(i);
    setDialogOpen(true);
  }

  function pedirBorrado(i: InterfazRow) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(i);
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
          <Palette className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Interfaces</h2>
        </div>
        <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {interfaces.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-muted-foreground">Sin interfaces. Creá la primera.</li>
        )}
        {interfaces.map((i) => {
          const isSelected = selectedId === i.id;
          return (
            <li
              key={i.id}
              onClick={() => onSelect(i.id)}
              className={`group flex cursor-pointer items-center justify-between border-l-2 px-5 py-3.5 transition-colors ${
                isSelected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/60"
              }`}
            >
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">[{i.codigo}]</span>
                  <span className="truncate text-sm font-medium text-foreground">{i.nombre}</span>
                </div>
                {(i.colorPrimario || i.colorSecundario) && (
                  <div className="flex items-center gap-1.5">
                    {i.colorPrimario && (
                      <span
                        className="size-3 rounded-full border border-border"
                        style={{ background: i.colorPrimario }}
                      />
                    )}
                    {i.colorSecundario && (
                      <span
                        className="size-3 rounded-full border border-border"
                        style={{ background: i.colorSecundario }}
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicion(i);
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
                    pedirBorrado(i);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <InterfazDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} interfaz={editing} onSave={onSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Interfaz"
        description={deleteError ?? `¿Eliminás la interfaz "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
