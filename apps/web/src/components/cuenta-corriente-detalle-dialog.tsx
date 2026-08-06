"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { listMovimientosXccAction, listAsientosXccAction } from "@/app/dashboard/cuenta-corriente/actions";
import type { XccMovimientoFila, XccAsientoFila } from "@valgian/module-cuenta-corriente";

interface CuentaCorrienteDetalleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idCuenta: string;
  numero: string;
}

const TABS = ["movimientos", "asientos"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { movimientos: "Movimientos", asientos: "Asientos" };

function formatearFecha(fecha: Date | string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatearMonto(n: number | null): string {
  if (n === null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

// Colores por SIGNO (XCC_TIPOS_MOVIMIENTOS.SIGNO), no por CODIGO/nombre — un
// tipo de movimiento nuevo (ej. otra transferencia) hereda el color solo
// respetando su signo en el seed, sin tocar este componente.
function claseColorPorSigno(signo: number | null | undefined): string {
  if (signo === null || signo === undefined) return "";
  return signo > 0 ? "text-emerald-500" : "text-destructive";
}

function TipoMovimientoBadge({ nombre, signo }: { nombre: string | null; signo: number | null | undefined }) {
  if (signo === null || signo === undefined) return <>{nombre ?? "—"}</>;
  return (
    <Badge
      variant="outline"
      className={signo > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-destructive/30 bg-destructive/10 text-destructive"}
    >
      {nombre ?? "—"}
    </Badge>
  );
}

/**
 * Solo lectura — detalle de una cuenta de Cuenta Corriente (movimientos
 * manuales + libro mayor). Ver docs/domain/cuenta-corriente.md.
 * Tab-bar y montado "una sola vez, ocultas con CSS" calcado de
 * tramite-modal.tsx/legajo-layout-modal.tsx — no el componente genérico
 * ui/tabs.tsx, para tener la misma pinta Y el mismo comportamiento (cambiar
 * de solapa no recarga la tabla ni resetea la paginación/filtro).
 */
export function CuentaCorrienteDetalleDialog({ open, onOpenChange, idCuenta, numero }: CuentaCorrienteDetalleDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>("movimientos");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-4xl! flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="font-mono">{numero}</DialogTitle>
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

        <div className={cn("flex-1 overflow-y-auto p-5", activeTab !== "movimientos" && "hidden")}>
          <MovimientosTab idCuenta={idCuenta} />
        </div>
        <div className={cn("flex-1 overflow-y-auto p-5", activeTab !== "asientos" && "hidden")}>
          <AsientosTab idCuenta={idCuenta} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RangoFechas({
  desde,
  hasta,
  onDesde,
  onHasta,
  onBuscar,
}: {
  desde: string;
  hasta: string;
  onDesde: (v: string) => void;
  onHasta: (v: string) => void;
  onBuscar: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Desde</Label>
        <Input type="date" value={desde} onChange={(e) => onDesde(e.target.value)} className="h-8 text-xs" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Hasta</Label>
        <Input type="date" value={hasta} onChange={(e) => onHasta(e.target.value)} className="h-8 text-xs" />
      </div>
      <Button size="sm" variant="outline" onClick={onBuscar}>
        <Search className="size-3.5" />
        Buscar
      </Button>
    </div>
  );
}

function PieDePagina({ pagina, hayMas, onPrev, onNext }: { pagina: number; hayMas: boolean; onPrev: () => void; onNext: () => void }) {
  if (pagina === 0 && !hayMas) return null;
  return (
    <div className="mt-2 flex items-center justify-end gap-3">
      <span className="text-xs text-muted-foreground">Página {pagina + 1}</span>
      <div className="flex items-center gap-1">
        {pagina > 0 && (
          <Button size="icon" variant="ghost" onClick={onPrev} className="size-7">
            <ChevronLeft className="size-3.5" />
          </Button>
        )}
        {hayMas && (
          <Button size="icon" variant="ghost" onClick={onNext} className="size-7">
            <ChevronRight className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function MovimientosTab({ idCuenta }: { idCuenta: string }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [desdeAplicado, setDesdeAplicado] = useState("");
  const [hastaAplicado, setHastaAplicado] = useState("");
  const [pagina, setPagina] = useState(0);
  const [rows, setRows] = useState<XccMovimientoFila[] | null>(null);
  const [hayMas, setHayMas] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setRows(null);
    listMovimientosXccAction(idCuenta, desdeAplicado || undefined, hastaAplicado || undefined, pagina).then((res) => {
      if (cancelado) return;
      setRows(res.data?.rows ?? []);
      setHayMas(res.data?.hayMas ?? false);
    });
    return () => {
      cancelado = true;
    };
  }, [idCuenta, desdeAplicado, hastaAplicado, pagina]);

  function buscar() {
    setPagina(0);
    setDesdeAplicado(desde);
    setHastaAplicado(hasta);
  }

  return (
    <div>
      <RangoFechas desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} onBuscar={buscar} />
      {rows === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Sin movimientos en el rango elegido.</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Nº Recibo</TableHead>
                <TableHead>Observaciones</TableHead>
                <TableHead>Cargado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{formatearFecha(r.fecha)}</TableCell>
                  <TableCell>
                    <TipoMovimientoBadge nombre={r.tipoNombre} signo={r.signo} />
                  </TableCell>
                  <TableCell className={`text-right font-mono ${claseColorPorSigno(r.signo)}`}>{formatearMonto(r.monto)}</TableCell>
                  <TableCell>{r.nroRecibo ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.observaciones ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.altaUsuarioNombre ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PieDePagina pagina={pagina} hayMas={hayMas} onPrev={() => setPagina((p) => p - 1)} onNext={() => setPagina((p) => p + 1)} />
    </div>
  );
}

function AsientosTab({ idCuenta }: { idCuenta: string }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [desdeAplicado, setDesdeAplicado] = useState("");
  const [hastaAplicado, setHastaAplicado] = useState("");
  const [pagina, setPagina] = useState(0);
  const [rows, setRows] = useState<XccAsientoFila[] | null>(null);
  const [hayMas, setHayMas] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setRows(null);
    listAsientosXccAction(idCuenta, desdeAplicado || undefined, hastaAplicado || undefined, pagina).then((res) => {
      if (cancelado) return;
      setRows(res.data?.rows ?? []);
      setHayMas(res.data?.hayMas ?? false);
    });
    return () => {
      cancelado = true;
    };
  }, [idCuenta, desdeAplicado, hastaAplicado, pagina]);

  function buscar() {
    setPagina(0);
    setDesdeAplicado(desde);
    setHastaAplicado(hasta);
  }

  return (
    <div>
      <RangoFechas desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} onBuscar={buscar} />
      {rows === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Sin asientos en el rango elegido.</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Saldo Capital</TableHead>
                <TableHead className="text-right">Saldo Interés</TableHead>
                <TableHead className="text-right">Tasa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{formatearFecha(r.fecha)}</TableCell>
                  <TableCell>{r.concepto ?? "—"}</TableCell>
                  <TableCell>
                    {r.idTipoRetencion ? (
                      <Badge variant="destructive">Retención</Badge>
                    ) : r.generadoPorMotor ? (
                      <Badge variant="outline">Motor</Badge>
                    ) : (
                      <TipoMovimientoBadge nombre={r.tipoNombre} signo={r.signo} />
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${r.idTipoRetencion ? "text-destructive" : ""}`}>{formatearMonto(r.monto)}</TableCell>
                  <TableCell className="text-right font-mono">{formatearMonto(r.saldoCapital)}</TableCell>
                  <TableCell className="text-right font-mono">{formatearMonto(r.saldoInteres)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{r.tasaAplicada ?? "—"}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PieDePagina pagina={pagina} hayMas={hayMas} onPrev={() => setPagina((p) => p - 1)} onNext={() => setPagina((p) => p + 1)} />
    </div>
  );
}
