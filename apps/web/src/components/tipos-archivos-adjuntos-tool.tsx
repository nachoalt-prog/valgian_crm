"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TipoArchivoAdjuntoDialog } from "@/components/tipo-archivo-adjunto-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { TipoArchivoAdjuntoInput } from "@valgian/core";
import {
  createTipoArchivoAdjuntoAction,
  updateTipoArchivoAdjuntoAction,
  deleteTipoArchivoAdjuntoAction,
} from "@/app/dashboard/tipos-archivos-adjuntos/actions";

interface TipoArchivoAdjuntoRow {
  id: string;
  codigo: string;
  nombre: string;
  extension: string | null;
  mimetype: string | null;
  permiteCarga: boolean | null;
  permiteDownload: boolean | null;
  renderizar: boolean | null;
}

interface TiposArchivosAdjuntosToolProps {
  tiposIniciales: TipoArchivoAdjuntoRow[];
  canGestionar: boolean;
}

function Flag({ activo, label }: { activo: boolean | null; label: string }) {
  return (
    <Badge variant={activo ? "default" : "secondary"} className="h-4 px-1.5 text-[10px]">
      {label}
    </Badge>
  );
}

export function TiposArchivosAdjuntosTool({ tiposIniciales, canGestionar }: TiposArchivosAdjuntosToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TipoArchivoAdjuntoRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TipoArchivoAdjuntoRow | null>(null);
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

  function abrirEdicion(t: TipoArchivoAdjuntoRow) {
    if (!canGestionar) return avisarSinPermiso();
    setEditing(t);
    setDialogOpen(true);
  }

  function pedirBorrado(t: TipoArchivoAdjuntoRow) {
    if (!canGestionar) return avisarSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(t);
  }

  async function handleSave(data: TipoArchivoAdjuntoInput, id?: string) {
    const result = id ? await updateTipoArchivoAdjuntoAction(id, data) : await createTipoArchivoAdjuntoAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deleteTipoArchivoAdjuntoAction(deleteConfirm.id);
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
            <FileType className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Tipos de Adjunto</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nuevo
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {tiposIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <FileType className="size-8 opacity-30" />
              <p className="text-sm">Sin tipos de adjunto creados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Extensión</TableHead>
                  <TableHead>Mimetype</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiposIniciales.map((t) => (
                  <TableRow key={t.id} className="group">
                    <TableCell className="font-mono text-xs text-primary">{t.codigo}</TableCell>
                    <TableCell>{t.nombre}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.extension ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.mimetype ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Flag activo={t.permiteCarga} label="Carga" />
                        <Flag activo={t.permiteDownload} label="Descarga" />
                        <Flag activo={t.renderizar} label="Previsualiza" />
                      </div>
                    </TableCell>
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

      <TipoArchivoAdjuntoDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} tipo={editing} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Tipo de Adjunto"
        description={deleteError ?? `¿Eliminás el tipo "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
