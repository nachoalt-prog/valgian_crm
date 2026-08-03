"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoriaTipoTramiteDialog } from "@/components/categoria-tipo-tramite-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { CategoriaTipoTramiteInput } from "@valgian/core";
import {
  crearCategoriaTipoTramiteAction,
  actualizarCategoriaTipoTramiteAction,
  borrarCategoriaTipoTramiteAction,
} from "@/app/dashboard/categorias-tipos-tramite/actions";

interface CategoriaRow {
  id: string;
  codigo: string;
  nombre: string;
  prefijo: string;
}

interface CategoriasTiposTramiteToolProps {
  categoriasIniciales: CategoriaRow[];
  canGestionar: boolean;
}

export function CategoriasTiposTramiteTool({ categoriasIniciales, canGestionar }: CategoriasTiposTramiteToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoriaRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CategoriaRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  function abrirNuevo() {
    if (!canGestionar) return avisarSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(c: CategoriaRow) {
    if (!canGestionar) return avisarSinPermiso();
    setEditing(c);
    setDialogOpen(true);
  }

  function pedirBorrado(c: CategoriaRow) {
    if (!canGestionar) return avisarSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(c);
  }

  async function handleSave(data: CategoriaTipoTramiteInput, id?: string) {
    const result = id ? await actualizarCategoriaTipoTramiteAction(id, data) : await crearCategoriaTipoTramiteAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await borrarCategoriaTipoTramiteAction(deleteConfirm.id);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteConfirm(null);
    router.refresh();
  }

  return (
    <div className="h-full overflow-hidden rounded-xl border border-border">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg">
          {aviso}
        </div>
      )}

      <section className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <FolderTree className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Categorías de Tipos de Trámite</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nueva
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {categoriasIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <FolderTree className="size-8 opacity-30" />
              <p className="text-sm">Sin categorías creadas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Prefijo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoriasIniciales.map((c) => (
                  <TableRow key={c.id} className="group">
                    <TableCell className="font-mono text-xs text-primary">{c.codigo}</TableCell>
                    <TableCell>{c.nombre}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.prefijo}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => abrirEdicion(c)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(c)}>
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
      </section>

      <CategoriaTipoTramiteDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} categoria={editing} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Categoría"
        description={deleteError ?? `¿Eliminás la categoría "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
