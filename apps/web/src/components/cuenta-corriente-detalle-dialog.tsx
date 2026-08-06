"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listMovimientosXccAction, listAsientosXccAction } from "@/app/dashboard/cuenta-corriente/actions";
import type { XccMovimientoFila, XccAsientoFila } from "@valgian/module-cuenta-corriente";

interface CuentaCorrienteDetalleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idCuenta: string;
  numero: string;
}

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

/** Solo lectura — detalle de una cuenta de Cuenta Corriente (movimientos manuales + libro mayor). Ver docs/domain/cuenta-corriente.md. */
export function CuentaCorrienteDetalleDialog({ open, onOpenChange, idCuenta, numero }: CuentaCorrienteDetalleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{numero}</DialogTitle>
        </DialogHeader>

        {/* Alto FIJO (h-, no max-h-) — con max-h el modal se achicaba en
            Movimientos (listado corto) y se agrandaba en Asientos (listado
            largo), dando un salto visual al cambiar de tab. overflow-y-auto
            acá, no en DialogContent — así el botón de cerrar (posicionado
            absoluto dentro del Popup) queda siempre visible en vez de
            scrollear junto con la tabla. min-w-0 en cada TabsContent: son
            flex items (Tabs es flex-col) que por default no se achican por
            debajo del ancho de su contenido — sin esto, una tabla ancha
            empuja el diálogo entero hacia afuera en vez de scrollear sola
            (el overflow-x-auto propio de <Table> solo funciona si el
            contenedor que lo envuelve puede achicarse). */}
        <div className="h-[70vh] overflow-y-auto">
          <Tabs defaultValue="movimientos">
            <TabsList>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
              <TabsTrigger value="asientos">Asientos</TabsTrigger>
            </TabsList>
            <TabsContent value="movimientos" className="min-w-0">
              <MovimientosTab idCuenta={idCuenta} activo={open} />
            </TabsContent>
            <TabsContent value="asientos" className="min-w-0">
              <AsientosTab idCuenta={idCuenta} activo={open} />
            </TabsContent>
          </Tabs>
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

function MovimientosTab({ idCuenta, activo }: { idCuenta: string; activo: boolean }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [desdeAplicado, setDesdeAplicado] = useState("");
  const [hastaAplicado, setHastaAplicado] = useState("");
  const [pagina, setPagina] = useState(0);
  const [rows, setRows] = useState<XccMovimientoFila[] | null>(null);
  const [hayMas, setHayMas] = useState(false);

  useEffect(() => {
    if (!activo) return;
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
  }, [activo, idCuenta, desdeAplicado, hastaAplicado, pagina]);

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
                  <TableCell>{r.tipoNombre ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{formatearMonto(r.monto)}</TableCell>
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

function AsientosTab({ idCuenta, activo }: { idCuenta: string; activo: boolean }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [desdeAplicado, setDesdeAplicado] = useState("");
  const [hastaAplicado, setHastaAplicado] = useState("");
  const [pagina, setPagina] = useState(0);
  const [rows, setRows] = useState<XccAsientoFila[] | null>(null);
  const [hayMas, setHayMas] = useState(false);

  useEffect(() => {
    if (!activo) return;
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
  }, [activo, idCuenta, desdeAplicado, hastaAplicado, pagina]);

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
                      (r.tipoNombre ?? "—")
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatearMonto(r.monto)}</TableCell>
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
