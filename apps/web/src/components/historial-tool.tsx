"use client";

import { useEffect, useState } from "react";
import { History, Paperclip } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { HistorialAdjuntosDialog } from "@/components/historial-adjuntos-dialog";
import { listHistorialAction, getEntidadHistorialIdAction } from "@/app/dashboard/historial/actions";
import type { HistorialFila } from "@valgian/core";

interface HistorialToolProps {
  idLegajo: string;
  idEntidad?: string;
  // Herramienta de solo lectura — no tiene acciones que gatear, pero recibe la
  // prop igual que el resto de las herramientas embebibles (LegajoHerramientaProps).
  canGestionar?: boolean;
  // Sube cada vez que otra solapa (ej. Gestión) reporta un cambio — como
  // Historial queda montado permanentemente, es la única forma de enterarse
  // de que hay un registro nuevo sin volver a abrir el modal.
  revision?: number;
}

function formatearFecha(fecha: Date | string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
}

function formatearStatus(fila: HistorialFila): string {
  if (fila.accionesStatus === null) return "OK";
  return fila.accionesError ?? String(fila.accionesStatus);
}

export function HistorialTool({ idLegajo, idEntidad, revision }: HistorialToolProps) {
  const [filas, setFilas] = useState<HistorialFila[] | null | undefined>(undefined);
  const [idEntidadHistorial, setIdEntidadHistorial] = useState<string | null>(null);
  const [adjuntosDe, setAdjuntosDe] = useState<string | null>(null);

  useEffect(() => {
    if (!idEntidad) return;
    let cancelado = false;
    listHistorialAction(idEntidad, idLegajo).then((res) => {
      if (!cancelado) setFilas(res.data ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, [idEntidad, idLegajo, revision]);

  useEffect(() => {
    let cancelado = false;
    getEntidadHistorialIdAction().then((res) => {
      if (!cancelado) setIdEntidadHistorial(res.data ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden p-5">
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <History className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">Historial</h3>
      </div>

      {filas === undefined ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filas === null || filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
      ) : (
        <div className="flex-1 overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado INI</TableHead>
                <TableHead>Estímulo</TableHead>
                <TableHead>Estado FIN</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Status de acciones</TableHead>
                <TableHead>Observación</TableHead>
                <TableHead>Adjuntos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell>{fila.estado0Nombre ?? "—"}</TableCell>
                  <TableCell>{fila.estimuloNombre ?? "—"}</TableCell>
                  <TableCell>{fila.estado1Nombre ?? "—"}</TableCell>
                  <TableCell>{formatearFecha(fila.auditFecha)}</TableCell>
                  <TableCell>{fila.auditUsuarioNombre ?? "—"}</TableCell>
                  <TableCell>{formatearStatus(fila)}</TableCell>
                  <TableCell className="max-w-md min-w-[16rem] wrap-break-word whitespace-normal">{fila.observacion ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-primary"
                      disabled={!idEntidadHistorial}
                      onClick={() => setAdjuntosDe(fila.id)}
                    >
                      <Paperclip className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {adjuntosDe && idEntidadHistorial && (
        <HistorialAdjuntosDialog
          open={!!adjuntosDe}
          onOpenChange={(open) => !open && setAdjuntosDe(null)}
          idHistorial={adjuntosDe}
          idEntidadHistorial={idEntidadHistorial}
        />
      )}
    </div>
  );
}
