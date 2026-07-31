"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, FileCode, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlantillaAdjuntoDialog } from "@/components/plantilla-adjunto-dialog";
import { ArchivoAdjuntoDialog } from "@/components/archivo-adjunto-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HERRAMIENTA_PLANTILLAS_CODIGO } from "@/lib/archivos-adjuntos-const";
import { borrarPlantillaAdjuntoAction } from "@/app/dashboard/plantillas-adjuntos/actions";
import type { PlantillaAdjuntoDetalle } from "@valgian/core";

interface PlantillasAdjuntosToolProps {
  plantillasIniciales: PlantillaAdjuntoDetalle[];
  canGestionar: boolean;
}

export function PlantillasAdjuntosTool({ plantillasIniciales, canGestionar }: PlantillasAdjuntosToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlantillaAdjuntoDetalle | null>(null);
  const [archivoTarget, setArchivoTarget] = useState<PlantillaAdjuntoDetalle | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PlantillaAdjuntoDetalle | null>(null);
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

  function abrirEdicion(p: PlantillaAdjuntoDetalle) {
    if (!canGestionar) return avisarSinPermiso();
    setEditing(p);
    setDialogOpen(true);
  }

  function pedirBorrado(p: PlantillaAdjuntoDetalle) {
    if (!canGestionar) return avisarSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(p);
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await borrarPlantillaAdjuntoAction(deleteConfirm.id);
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
            <FileCode className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Plantillas de Documento</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nueva
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {plantillasIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <FileCode className="size-8 opacity-30" />
              <p className="text-sm">Sin plantillas creadas. Creá la primera.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plantillasIniciales.map((p) => (
                  <TableRow key={p.id} className="group cursor-pointer" onClick={() => setArchivoTarget(p)}>
                    <TableCell className="font-mono text-xs text-primary">{p.codigo}</TableCell>
                    <TableCell>{p.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{p.descripcion ?? "—"}</TableCell>
                    <TableCell>
                      {p.idArchivoAdjunto ? (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Paperclip className="size-2.5" />
                          Cargado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Sin archivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <PlantillaAdjuntoDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plantilla={editing}
        onGuardado={() => router.refresh()}
      />

      {archivoTarget && (
        <ArchivoAdjuntoDialog
          key={archivoTarget.id}
          open={!!archivoTarget}
          onOpenChange={(open) => !open && setArchivoTarget(null)}
          idArchivoExistente={archivoTarget.idArchivoAdjunto}
          idEntidad={null}
          idRegistro={null}
          herramientaCodigo={HERRAMIENTA_PLANTILLAS_CODIGO}
          canCrear={canGestionar}
          canReemplazar={canGestionar}
          canDescargar={canGestionar}
          canGuardar={canGestionar}
          onGuardado={() => router.refresh()}
          tiposPermitidos={["html"]}
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
        title="Eliminar Plantilla"
        description={deleteError ?? `¿Eliminás la plantilla "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
