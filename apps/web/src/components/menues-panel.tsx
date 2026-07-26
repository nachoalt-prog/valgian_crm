"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MenuDialog } from "@/components/menu-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { MenuConContador } from "@valgian/core";

interface MenuesPanelProps {
  menues: MenuConContador[];
  selectedMenuId: string | null;
  onSelectMenu: (id: string) => void;
  canGestionar: boolean;
  onSinPermiso: () => void;
  onSave: (data: { codigo: string; nombre: string }, id?: string) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function MenuesPanel({
  menues,
  selectedMenuId,
  onSelectMenu,
  canGestionar,
  onSinPermiso,
  onSave,
  onDelete,
}: MenuesPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuConContador | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MenuConContador | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditingMenu(null);
    setDialogOpen(true);
  }

  function abrirEdicion(m: MenuConContador) {
    if (!canGestionar) return onSinPermiso();
    setEditingMenu(m);
    setDialogOpen(true);
  }

  function pedirBorrado(m: MenuConContador) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(m);
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
          <ListTree className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Menúes</h2>
        </div>
        <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {menues.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-muted-foreground">Sin menúes. Creá el primero.</li>
        )}
        {menues.map((m) => {
          const isSelected = selectedMenuId === m.id;
          return (
            <li
              key={m.id}
              onClick={() => onSelectMenu(m.id)}
              className={`group flex cursor-pointer items-center justify-between border-l-2 px-5 py-3.5 transition-colors ${
                isSelected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/60"
              }`}
            >
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">[{m.codigo}]</span>
                  <span className="truncate text-sm font-medium text-foreground">{m.nombre}</span>
                </div>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {m.opcionesCount} opción{m.opcionesCount !== 1 ? "es" : ""}
                </Badge>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirEdicion(m);
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
                    pedirBorrado(m);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <MenuDialog key={editingMenu?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} menu={editingMenu} onSave={onSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Menú"
        description={deleteError ?? `¿Eliminás el menú "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
