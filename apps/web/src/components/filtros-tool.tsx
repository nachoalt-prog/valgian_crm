"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FiltroDialog } from "@/components/filtro-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { FiltroInput } from "@valgian/core";
import { createFiltroAction, updateFiltroAction, deleteFiltroAction } from "@/app/dashboard/filtros/actions";

interface FiltroRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string | null;
  query: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  texto_like: "Texto (contiene)",
  select: "Selección",
  fecha: "Fecha",
  fecha_rango: "Rango de fechas",
};

interface FiltrosToolProps {
  filtrosIniciales: FiltroRow[];
  canGestionar: boolean;
}

export function FiltrosTool({ filtrosIniciales, canGestionar }: FiltrosToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FiltroRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FiltroRow | null>(null);
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

  function abrirEdicion(f: FiltroRow) {
    if (!canGestionar) return avisarSinPermiso();
    setEditing(f);
    setDialogOpen(true);
  }

  function pedirBorrado(f: FiltroRow) {
    if (!canGestionar) return avisarSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(f);
  }

  async function handleSave(data: FiltroInput, id?: string) {
    const result = id ? await updateFiltroAction(id, data) : await createFiltroAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deleteFiltroAction(deleteConfirm.id);
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
            <Filter className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Filtros</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nuevo
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {filtrosIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Filter className="size-8 opacity-30" />
              <p className="text-sm">Sin filtros creados. Creá el primero.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrosIniciales.map((f) => (
                  <TableRow key={f.id} className="group">
                    <TableCell className="font-mono text-xs text-primary">{f.codigo}</TableCell>
                    <TableCell>{f.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {TIPO_LABEL[f.tipo ?? ""] ?? f.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => abrirEdicion(f)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(f)}>
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

      <FiltroDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} filtro={editing} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Filtro"
        description={deleteError ?? `¿Eliminás el filtro "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
