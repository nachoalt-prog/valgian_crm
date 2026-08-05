"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, Boxes, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductoDialog } from "@/components/producto-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { CategoriaProductoConContador, ProductoConCategoria } from "@valgian/core";

interface MonedaOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface ProductosPanelProps {
  productos: ProductoConCategoria[];
  selectedCategoria: CategoriaProductoConContador | null;
  monedas: MonedaOption[];
  canGestionar: boolean;
  onSinPermiso: () => void;
  onSave: (data: { idCategoria: string; idMoneda: string | null; codigo: string; nombre: string }, id?: string) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function ProductosPanel({ productos, selectedCategoria, monedas, canGestionar, onSinPermiso, onSave, onDelete }: ProductosPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductoConCategoria | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProductoConCategoria | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtrados = selectedCategoria ? productos.filter((p) => p.idCategoria === selectedCategoria.id) : productos;

  function abrirNuevo() {
    if (!selectedCategoria) return;
    if (!canGestionar) return onSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(p: ProductoConCategoria) {
    if (!canGestionar) return onSinPermiso();
    setEditing(p);
    setDialogOpen(true);
  }

  function pedirBorrado(p: ProductoConCategoria) {
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
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Boxes className="size-4 shrink-0 text-accent" />
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-accent">Productos</h2>
            {selectedCategoria && (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono text-primary">[{selectedCategoria.codigo}]</span> {selectedCategoria.nombre}
                </span>
              </>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={abrirNuevo}
          disabled={!selectedCategoria}
          className="h-8 shrink-0 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 text-xs"
        >
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      {!selectedCategoria && (
        <div className="border-b border-border bg-muted/30 px-5 py-2.5">
          <p className="text-xs text-muted-foreground">Seleccioná una categoría para ver y agregar sus productos.</p>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {filtrados.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Boxes className="size-8 opacity-30" />
            <p className="text-sm">Sin productos{selectedCategoria ? " en esta categoría" : ""}.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Categoría</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((p) => (
                <TableRow key={p.id} className="group">
                  <TableCell>
                    <span className="font-medium text-foreground">{p.nombre}</span>{" "}
                    <span className="font-mono text-xs text-muted-foreground">[{p.codigo}]</span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {p.categoriaNombre ?? <span className="italic">Sin categoría</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-accent" onClick={() => abrirEdicion(p)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(p)}>
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

      {selectedCategoria && (
        <ProductoDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          producto={editing}
          categoriaId={selectedCategoria.id}
          monedas={monedas}
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
        title="Eliminar Producto"
        description={deleteError ?? `¿Eliminás el producto "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
