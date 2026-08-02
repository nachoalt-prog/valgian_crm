"use client";

import { useEffect, useState } from "react";
import { ListOrdered } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { listPasosDeEjecucionAction } from "@/app/dashboard/reportes/pasos-actions";
import type { ProcesoEjecucionPasoDetalle } from "@valgian/core";

interface ProcesosEjecucionPasosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idEjecucion: string;
}

const VARIANTE_POR_ESTADO: Record<string, "outline" | "destructive"> = {
  completado: "outline",
  error: "destructive",
};

/** Solo lectura — historial detallado de una ejecución puntual (PROCESOS_EJECUCIONES_PASOS). Ver domain/procesos.md. */
export function ProcesosEjecucionPasosDialog({ open, onOpenChange, idEjecucion }: ProcesosEjecucionPasosDialogProps) {
  const [pasos, setPasos] = useState<ProcesoEjecucionPasoDetalle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setPasos(null);
    setError(null);

    listPasosDeEjecucionAction(idEjecucion).then((res) => {
      if (cancelado) return;
      if (res.error) {
        setError(res.error);
        return;
      }
      setPasos(res.data ?? []);
    });

    return () => {
      cancelado = true;
    };
  }, [open, idEjecucion]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="size-4" />
            Pasos de la ejecución
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && pasos === null && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!error && pasos?.length === 0 && <p className="text-sm text-muted-foreground">Esta ejecución todavía no corrió ningún paso.</p>}
          {!error && pasos && pasos.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {pasos.map((p) => (
                <li key={p.id} className="flex flex-col gap-1 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-foreground">{p.pasoNombre ?? "(paso eliminado)"}</span>
                    <Badge variant={VARIANTE_POR_ESTADO[p.estado] ?? "outline"} className="shrink-0 text-[10px]">
                      {p.estado}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(p.fechaInicio).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {p.fechaFin &&
                        ` — ${new Date(p.fechaFin).toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit" })}`}
                    </span>
                  </div>
                  {p.error && <p className="text-xs text-destructive">{p.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
