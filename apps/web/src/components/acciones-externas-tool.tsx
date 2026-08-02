"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, Cable } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccionExternaDialog } from "@/components/accion-externa-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { AccionExternaInput } from "@valgian/core";
import { createAccionExternaAction, updateAccionExternaAction, deleteAccionExternaAction } from "@/app/dashboard/acciones-externas/actions";

interface AccionExternaRow {
  id: string;
  codigo: string;
  nombre: string;
  componente: string;
  parametros: unknown;
  activo: boolean | null;
  inmediato: boolean | null;
  reintentosMax: number | null;
  reintentosMargen: number | null;
}

interface AccionesExternasToolProps {
  accionesIniciales: AccionExternaRow[];
  canGestionar: boolean;
}

export function AccionesExternasTool({ accionesIniciales, canGestionar }: AccionesExternasToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccionExternaRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AccionExternaRow | null>(null);
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

  function abrirEdicion(a: AccionExternaRow) {
    if (!canGestionar) return avisarSinPermiso();
    setEditing(a);
    setDialogOpen(true);
  }

  function pedirBorrado(a: AccionExternaRow) {
    if (!canGestionar) return avisarSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(a);
  }

  async function handleSave(data: AccionExternaInput, id?: string) {
    const result = id ? await updateAccionExternaAction(id, data) : await createAccionExternaAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deleteAccionExternaAction(deleteConfirm.id);
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
            <Cable className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Acciones Externas</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nueva
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {accionesIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Cable className="size-8 opacity-30" />
              <p className="text-sm">Sin acciones externas creadas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Componente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Reintentos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accionesIniciales.map((a) => (
                  <TableRow key={a.id} className="group">
                    <TableCell className="font-mono text-xs text-primary">{a.codigo}</TableCell>
                    <TableCell>{a.nombre}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.componente}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={a.activo ? "outline" : "destructive"} className="text-[10px]">
                          {a.activo ? "Activo" : "Pausado"}
                        </Badge>
                        {a.inmediato && (
                          <Badge variant="outline" className="text-[10px]">
                            Inmediato
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.reintentosMax ?? "—"} máx · {a.reintentosMargen ?? "—"} min
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => abrirEdicion(a)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(a)}>
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

      <AccionExternaDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} accion={editing} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Acción Externa"
        description={deleteError ?? `¿Eliminás "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
