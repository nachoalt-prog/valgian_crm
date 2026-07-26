"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, Boxes, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SubProductoDialog } from "@/components/sub-producto-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { ProductoConContador, SubProductoConProducto } from "@valgian/core";

interface SubProductosPanelProps {
  subProductos: SubProductoConProducto[];
  selectedProducto: ProductoConContador | null;
  canGestionar: boolean;
  onSinPermiso: () => void;
  onSave: (data: { idProducto: string; codigo: string; nombre: string }, id?: string) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function SubProductosPanel({
  subProductos,
  selectedProducto,
  canGestionar,
  onSinPermiso,
  onSave,
  onDelete,
}: SubProductosPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubProductoConProducto | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SubProductoConProducto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtrados = selectedProducto ? subProductos.filter((s) => s.idProducto === selectedProducto.id) : subProductos;

  function abrirNuevo() {
    if (!selectedProducto) return;
    if (!canGestionar) return onSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(s: SubProductoConProducto) {
    if (!canGestionar) return onSinPermiso();
    setEditing(s);
    setDialogOpen(true);
  }

  function pedirBorrado(s: SubProductoConProducto) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(s);
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
          <Boxes className="size-4 shrink-0 text-accent" />
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-accent">Sub-productos</h2>
            {selectedProducto && (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono text-primary">[{selectedProducto.codigo}]</span> {selectedProducto.nombre}
                </span>
              </>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={abrirNuevo}
          disabled={!selectedProducto}
          className="h-8 shrink-0 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 text-xs"
        >
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      {!selectedProducto && (
        <div className="border-b border-border bg-muted/30 px-5 py-2.5">
          <p className="text-xs text-muted-foreground">Seleccioná un producto para ver y agregar sus sub-productos.</p>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {filtrados.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Boxes className="size-8 opacity-30" />
            <p className="text-sm">Sin sub-productos{selectedProducto ? " en este producto" : ""}.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Producto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((s) => (
                <TableRow key={s.id} className="group">
                  <TableCell>
                    <span className="font-medium text-foreground">{s.nombre}</span>{" "}
                    <span className="font-mono text-xs text-muted-foreground">[{s.codigo}]</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {s.productoNombre ?? <span className="italic">Sin producto</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-accent" onClick={() => abrirEdicion(s)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(s)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedProducto && (
        <SubProductoDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          subProducto={editing}
          productoId={selectedProducto.id}
          onSave={onSave}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Sub-producto"
        description={deleteError ?? `¿Eliminás el sub-producto "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
