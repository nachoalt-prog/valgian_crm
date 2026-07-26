"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductoDialog } from "@/components/producto-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { ProductoConContador } from "@valgian/core";

interface ProductosPanelProps {
  productos: ProductoConContador[];
  selectedProductoId: string | null;
  onSelectProducto: (id: string) => void;
  canGestionar: boolean;
  onSinPermiso: () => void;
  onSave: (data: { modulo: string | null; codigo: string; nombre: string }, id?: string) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function ProductosPanel({
  productos,
  selectedProductoId,
  onSelectProducto,
  canGestionar,
  onSinPermiso,
  onSave,
  onDelete,
}: ProductosPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<ProductoConContador | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProductoConContador | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditingProducto(null);
    setDialogOpen(true);
  }

  function abrirEdicion(p: ProductoConContador) {
    if (!canGestionar) return onSinPermiso();
    setEditingProducto(p);
    setDialogOpen(true);
  }

  function pedirBorrado(p: ProductoConContador) {
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
          <Package className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Productos</h2>
        </div>
        <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {productos.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-muted-foreground">Sin productos. Creá el primero.</li>
        )}
        {productos.map((p) => {
          const isSelected = selectedProductoId === p.id;
          return (
            <li
              key={p.id}
              onClick={() => onSelectProducto(p.id)}
              className={`group flex cursor-pointer items-center justify-between border-l-2 px-5 py-3.5 transition-colors ${
                isSelected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/60"
              }`}
            >
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">[{p.codigo}]</span>
                  <span className="truncate text-sm font-medium text-foreground">{p.nombre}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.modulo && (
                    <Badge variant="outline" className="h-4 border-accent/40 px-1.5 font-mono text-[10px] text-accent">
                      {p.modulo}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    {p.subProductosCount} sub-producto{p.subProductosCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
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

      <ProductoDialog key={editingProducto?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} producto={editingProducto} onSave={onSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Producto"
        description={deleteError ?? `¿Eliminás el producto "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
