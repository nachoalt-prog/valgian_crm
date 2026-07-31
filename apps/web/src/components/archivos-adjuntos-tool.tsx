"use client";

import { useEffect, useState } from "react";
import { Paperclip, PlusCircle, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArchivoAdjuntoDialog } from "@/components/archivo-adjunto-dialog";
import {
  listArchivosAdjuntosAction,
  getPermisosGranularesAdjuntosAction,
  type PermisosGranularesAdjuntos,
} from "@/app/dashboard/archivos-adjuntos/actions";
import { HERRAMIENTA_ADJUNTOS_CODIGO } from "@/lib/archivos-adjuntos-const";
import type { ArchivoAdjuntoDetalle } from "@valgian/core";

const SIN_PERMISOS_GRANULARES: PermisosGranularesAdjuntos = {
  crear: false,
  reemplazar: false,
  descargar: false,
  guardar: false,
  borrar: false,
};

interface ArchivosAdjuntosToolProps {
  idLegajo: string;
  idEntidad?: string;
  canGestionar: boolean;
  revision: number;
  onCambio: () => void;
}

interface DialogTarget {
  id: string | null;
}

export function ArchivosAdjuntosTool({ idLegajo, idEntidad, revision, onCambio }: ArchivosAdjuntosToolProps) {
  const [archivos, setArchivos] = useState<ArchivoAdjuntoDetalle[] | null | undefined>(undefined);
  const [dialogTarget, setDialogTarget] = useState<DialogTarget | null>(null);
  const [permisos, setPermisos] = useState<PermisosGranularesAdjuntos>(SIN_PERMISOS_GRANULARES);

  useEffect(() => {
    if (!idEntidad) return;
    let cancelado = false;
    listArchivosAdjuntosAction(idEntidad, idLegajo).then((res) => {
      if (!cancelado) setArchivos(res.data ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, [idEntidad, idLegajo, revision]);

  useEffect(() => {
    let cancelado = false;
    getPermisosGranularesAdjuntosAction().then((data) => {
      if (!cancelado) setPermisos(data);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="size-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">Archivos Adjuntos</h3>
        </div>
        {permisos.crear && idEntidad && (
          <Button size="sm" variant="outline" onClick={() => setDialogTarget({ id: null })}>
            <PlusCircle className="size-3.5" />
            Nuevo
          </Button>
        )}
      </div>

      {archivos === undefined ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : archivos === null || archivos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin archivos adjuntos.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {archivos.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setDialogTarget({ id: a.id })}
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center hover:bg-muted/40"
            >
              {a.renderizar && a.mimetype?.startsWith("image/") ? (
                <img
                  src={`/api/archivos-adjuntos/${a.id}?inline=1&herramientaCodigo=${HERRAMIENTA_ADJUNTOS_CODIGO}`}
                  alt={a.nombreOriginal ?? ""}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : (
                <FileIcon className="size-8 text-muted-foreground" />
              )}
              <span className="w-full truncate text-xs text-foreground">{a.nombreOriginal ?? "Sin nombre"}</span>
            </button>
          ))}
        </div>
      )}

      {dialogTarget && idEntidad && (
        <ArchivoAdjuntoDialog
          key={dialogTarget.id ?? "nuevo"}
          open={!!dialogTarget}
          onOpenChange={(open) => !open && setDialogTarget(null)}
          idArchivoExistente={dialogTarget.id}
          idEntidad={idEntidad}
          idRegistro={idLegajo}
          herramientaCodigo={HERRAMIENTA_ADJUNTOS_CODIGO}
          canCrear={permisos.crear}
          canReemplazar={permisos.reemplazar}
          canDescargar={permisos.descargar}
          canGuardar={permisos.guardar}
          canBorrar={permisos.borrar}
          onGuardado={onCambio}
        />
      )}
    </div>
  );
}
