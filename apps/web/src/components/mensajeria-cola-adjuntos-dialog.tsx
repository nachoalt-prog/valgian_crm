"use client";

import { useEffect, useState } from "react";
import { Download, Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listMensajeriaColaAdjuntosAction } from "@/app/dashboard/reportes/adjuntos-actions";
import type { MensajeriaColaAdjuntoDetalle } from "@valgian/core";

interface MensajeriaColaAdjuntosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idMensajeriaCola: string;
}

/** Solo lectura — no permite cargar/reemplazar/borrar, a diferencia de ArchivoAdjuntoDialog. Ver domain/acciones-externas.md. */
export function MensajeriaColaAdjuntosDialog({ open, onOpenChange, idMensajeriaCola }: MensajeriaColaAdjuntosDialogProps) {
  const [adjuntos, setAdjuntos] = useState<MensajeriaColaAdjuntoDetalle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setAdjuntos(null);
    setError(null);

    listMensajeriaColaAdjuntosAction(idMensajeriaCola).then((res) => {
      if (cancelado) return;
      if (res.error) {
        setError(res.error);
        return;
      }
      setAdjuntos(res.data ?? []);
    });

    return () => {
      cancelado = true;
    };
  }, [open, idMensajeriaCola]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="size-4" />
            Adjuntos del mensaje
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && adjuntos === null && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!error && adjuntos?.length === 0 && <p className="text-sm text-muted-foreground">Este mensaje no tiene adjuntos.</p>}
          {!error && adjuntos && adjuntos.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {adjuntos.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-3 py-2.5">
                  <span className="truncate text-sm text-foreground">{a.nombreOriginal ?? "(sin nombre)"}</span>
                  <a
                    href={`/api/archivos-adjuntos/${a.id}?herramientaCodigo=reportes`}
                    className="flex shrink-0 items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Download className="size-3.5" />
                    Descargar
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
