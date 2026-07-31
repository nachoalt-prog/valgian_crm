"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArchivosAdjuntosTool } from "@/components/archivos-adjuntos-tool";

interface HistorialAdjuntosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idHistorial: string;
  idEntidadHistorial: string;
}

/**
 * "ABM de archivos adjuntos" embebido en un modal chico, para el botón
 * "Adjuntos" de cada fila de HistorialTool — muestra/gestiona los adjuntos
 * vinculados a ESE movimiento puntual (idEntidad='historial', idRegistro=el
 * propio HISTORIAL.ID). Sin PARAMETROS propios: se rige solo por el permiso
 * granular del perfil sobre LEGAJO_ADJ_1, igual que la solapa de legajo.
 */
export function HistorialAdjuntosDialog({ open, onOpenChange, idHistorial, idEntidadHistorial }: HistorialAdjuntosDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[70vh] max-w-2xl! flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Adjuntos del movimiento</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <ArchivosAdjuntosTool
            idLegajo={idHistorial}
            idEntidad={idEntidadHistorial}
            canGestionar
            revision={0}
            onCambio={() => {}}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
