"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArchivosAdjuntosTool } from "@/components/archivos-adjuntos-tool";
import { HistorialAdjuntosDialog } from "@/components/historial-adjuntos-dialog";
import { cn, handleTabEnTextarea } from "@/lib/utils";
import { getEntidadHistorialIdAction } from "@/app/dashboard/historial/actions";
import {
  getEstimulosDisponiblesCuentaAction,
  aplicarEstimuloCuentaAction,
  listHistorialCuentaAction,
} from "@/app/dashboard/cuenta-corriente/actions";
import type { EstimulosDisponiblesResult, HistorialFila } from "@valgian/core";

interface CuentaCorrienteGestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idCuenta: string;
  numero: string;
  idEntidad: string;
  gestionar: boolean;
  onCambio: () => void;
}

const TABS = ["gestion", "historial", "adjuntos"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { gestion: "Gestión", historial: "Historial", adjuntos: "Adjuntos" };

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

/**
 * Gestión (motor de estados) + Historial + Adjuntos de una cuenta XCC.
 * Tab-bar y montado "una sola vez, ocultas con CSS" calcado de
 * tramite-modal.tsx/legajo-layout-modal.tsx — no el componente genérico
 * ui/tabs.tsx, para tener la misma pinta Y el mismo comportamiento
 * (cambiar de solapa no recarga: cada una fetchea una sola vez al montar,
 * revisionHistorial es la única forma de que Historial se entere de un
 * estímulo aplicado en la solapa de al lado, sin volver a montarse).
 * Gestión/Historial con permiso propio (XCC_CUENTA_GESTION_1), no el de
 * legajo. Adjuntos reusa ArchivosAdjuntosTool tal cual (permiso compartido
 * LEGAJO_ADJ_1, mismo criterio que trámites) — igual que el botón "Adjuntos"
 * por fila de Historial, que reusa HistorialAdjuntosDialog directo.
 */
export function CuentaCorrienteGestionDialog({ open, onOpenChange, idCuenta, numero, idEntidad, gestionar, onCambio }: CuentaCorrienteGestionDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>("gestion");
  const [revisionHistorial, setRevisionHistorial] = useState(0);
  const [revisionAdjuntos, setRevisionAdjuntos] = useState(0);
  const bumpRevisionHistorial = useCallback(() => setRevisionHistorial((r) => r + 1), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-4xl! flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="font-mono">{numero} — Gestión</DialogTitle>
        </DialogHeader>

        <div className="flex shrink-0 gap-1 border-b border-border px-5 pt-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "-mb-px rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "border-border bg-popover text-foreground"
                  : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/60",
              )}
            >
              {TAB_LABEL[tab]}
            </button>
          ))}
        </div>

        {/* Las 3 quedan montadas desde que se abre el diálogo — se ocultan con
            CSS al cambiar de solapa, no se desmontan, así cada una fetchea sus
            datos una única vez (mismo criterio que legajo-layout-modal.tsx). */}
        <div className={cn("flex-1 overflow-y-auto p-5", activeTab !== "gestion" && "hidden")}>
          <GestionTab idCuenta={idCuenta} idEntidad={idEntidad} gestionar={gestionar} onCambio={() => {
            onCambio();
            bumpRevisionHistorial();
          }} />
        </div>
        <div className={cn("flex-1 overflow-y-auto p-5", activeTab !== "historial" && "hidden")}>
          <HistorialTab idCuenta={idCuenta} idEntidad={idEntidad} revision={revisionHistorial} />
        </div>
        <div className={cn("flex-1 overflow-hidden", activeTab !== "adjuntos" && "hidden")}>
          <ArchivosAdjuntosTool
            idLegajo={idCuenta}
            idEntidad={idEntidad}
            canGestionar={gestionar}
            parametros={null}
            revision={revisionAdjuntos}
            onCambio={() => setRevisionAdjuntos((r) => r + 1)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GestionTab({
  idCuenta,
  idEntidad,
  gestionar,
  onCambio,
}: {
  idCuenta: string;
  idEntidad: string;
  gestionar: boolean;
  onCambio: () => void;
}) {
  const [datos, setDatos] = useState<EstimulosDisponiblesResult | null | undefined>(undefined);
  const [idEstimulo, setIdEstimulo] = useState<string | null>(null);
  const [observacion, setObservacion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    getEstimulosDisponiblesCuentaAction(idEntidad, idCuenta).then((res) => {
      if (!cancelado) setDatos(res.data ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, [idEntidad, idCuenta]);

  async function handleGestionar() {
    if (!idEstimulo) return;
    setPending(true);
    setError(null);
    setExito(null);
    const result = await aplicarEstimuloCuentaAction(idEntidad, idCuenta, idEstimulo, observacion);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setExito("Estímulo aplicado correctamente.");
    setObservacion("");
    setIdEstimulo(null);
    const refreshed = await getEstimulosDisponiblesCuentaAction(idEntidad, idCuenta);
    setDatos(refreshed.data ?? null);
    onCambio();
  }

  if (datos === undefined) return <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>;
  if (datos === null || !datos.estadoActual) return <p className="py-6 text-center text-sm text-muted-foreground">No se encontró el estado actual de la cuenta.</p>;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1 border-b border-border pb-3">
        <span className="text-xs tracking-wider text-muted-foreground uppercase">Estado actual</span>
        <span className="text-sm font-medium text-foreground">{datos.estadoActual.nombre}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs tracking-wider text-muted-foreground uppercase">Estímulo</label>
        {datos.estimulos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay estímulos disponibles para aplicar desde este estado.</p>
        ) : (
          <Select
            items={Object.fromEntries(datos.estimulos.map((e) => [e.id, e.nombre]))}
            value={idEstimulo}
            onValueChange={(v) => setIdEstimulo(v ?? null)}
            disabled={!gestionar}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccioná un estímulo…" />
            </SelectTrigger>
            <SelectContent>
              {datos.estimulos.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs tracking-wider text-muted-foreground uppercase">Observación</label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          onKeyDown={(e) => handleTabEnTextarea(e, setObservacion)}
          disabled={!gestionar}
          rows={4}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {exito && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-500">
          <CheckCircle2 className="size-3.5" />
          {exito}
        </p>
      )}

      <div>
        <Button onClick={handleGestionar} disabled={!gestionar || !idEstimulo || pending}>
          {pending ? "Gestionando…" : "Gestionar"}
        </Button>
        {!gestionar && <p className="mt-2 text-xs text-muted-foreground">Tu perfil no tiene permiso de gestión sobre las cuentas.</p>}
      </div>
    </div>
  );
}

function HistorialTab({ idCuenta, idEntidad, revision }: { idCuenta: string; idEntidad: string; revision: number }) {
  const [filas, setFilas] = useState<HistorialFila[] | null | undefined>(undefined);
  const [idEntidadHistorial, setIdEntidadHistorial] = useState<string | null>(null);
  const [adjuntosDe, setAdjuntosDe] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    listHistorialCuentaAction(idEntidad, idCuenta).then((res) => {
      if (!cancelado) setFilas(res.data ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, [idEntidad, idCuenta, revision]);

  useEffect(() => {
    let cancelado = false;
    getEntidadHistorialIdAction().then((res) => {
      if (!cancelado) setIdEntidadHistorial(res.data ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  if (filas === undefined) return <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>;
  if (filas === null || filas.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Sin movimientos registrados.</p>;

  return (
    <>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado INI</TableHead>
              <TableHead>Estímulo</TableHead>
              <TableHead>Estado FIN</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Status</TableHead>
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
                <TableCell className="font-mono">{formatearFecha(fila.auditFecha)}</TableCell>
                <TableCell>{fila.auditUsuarioNombre ?? "—"}</TableCell>
                <TableCell>{formatearStatus(fila)}</TableCell>
                <TableCell className="max-w-md min-w-[16rem] wrap-break-word whitespace-pre-wrap">{fila.observacion ?? "—"}</TableCell>
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

      {adjuntosDe && idEntidadHistorial && (
        <HistorialAdjuntosDialog
          open={!!adjuntosDe}
          onOpenChange={(open) => !open && setAdjuntosDe(null)}
          idHistorial={adjuntosDe}
          idEntidadHistorial={idEntidadHistorial}
        />
      )}
    </>
  );
}
