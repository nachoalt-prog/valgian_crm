"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { XccTipoRetencionDialog } from "@/components/xcc-tipo-retencion-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { TipoRetencionInput } from "@valgian/module-cuenta-corriente";
import { createTipoRetencionAction, updateTipoRetencionAction, deleteTipoRetencionAction } from "@/app/dashboard/xcc-tipos-retencion/actions";

export interface TipoRetencionRow {
  id: string;
  codigo: string;
  nombre: string;
  orden: number | null;
  activa: boolean | null;
  alicuota: number | null;
  usaCondicionImpositiva: boolean | null;
}

interface XccTiposRetencionToolProps {
  tiposIniciales: TipoRetencionRow[];
  canGestionar: boolean;
}

export function XccTiposRetencionTool({ tiposIniciales, canGestionar }: XccTiposRetencionToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TipoRetencionRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TipoRetencionRow | null>(null);
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

  function abrirEdicion(t: TipoRetencionRow) {
    if (!canGestionar) return avisarSinPermiso();
    setEditing(t);
    setDialogOpen(true);
  }

  function pedirBorrado(t: TipoRetencionRow) {
    if (!canGestionar) return avisarSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(t);
  }

  async function handleSave(data: TipoRetencionInput, id?: string) {
    const result = id ? await updateTipoRetencionAction(id, data) : await createTipoRetencionAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deleteTipoRetencionAction(deleteConfirm.id);
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
            <Percent className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Tipos de Retención (Cuenta Corriente)</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nueva
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {tiposIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Percent className="size-8 opacity-30" />
              <p className="text-sm">Sin tipos de retención creados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Activa</TableHead>
                  <TableHead>Alícuota</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiposIniciales.map((t) => (
                  <TableRow key={t.id} className="group">
                    <TableCell className="font-mono text-xs text-primary">{t.codigo}</TableCell>
                    <TableCell>{t.nombre}</TableCell>
                    <TableCell>
                      {t.activa ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactiva</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {t.usaCondicionImpositiva ? "Por condición impositiva" : `${t.alicuota ?? 0}%`}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.orden ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => abrirEdicion(t)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(t)}>
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

      <XccTipoRetencionDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} tipo={editing} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Tipo de Retención"
        description={deleteError ?? `¿Eliminás el tipo "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
