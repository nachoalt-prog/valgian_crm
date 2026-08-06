"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CuentaCorrienteDetalleDialog } from "@/components/cuenta-corriente-detalle-dialog";
import { getResumenConsolidadoLegajoAction } from "@/app/dashboard/cuenta-corriente/actions";
import type { XccCuentaResumen } from "@valgian/module-cuenta-corriente";

interface CuentaCorrienteResumenToolProps {
  idLegajo: string;
  // Herramienta de solo lectura — no tiene acciones que gatear, pero recibe
  // la prop igual que el resto de las herramientas embebibles (LegajoHerramientaProps).
  canGestionar?: boolean;
  revision?: number;
}

type Resumen = { cuentas: XccCuentaResumen[]; totalCapital: number; totalInteres: number };

function formatearMonto(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
}

function formatearFecha(fecha: Date | string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Solo lectura — resumen consolidado de las cuentas de Cuenta Corriente (módulo XCC) del legajo. Ver docs/domain/cuenta-corriente.md. */
export function CuentaCorrienteResumenTool({ idLegajo, revision }: CuentaCorrienteResumenToolProps) {
  const [resumen, setResumen] = useState<Resumen | null | undefined>(undefined);
  const [cuentaAbierta, setCuentaAbierta] = useState<XccCuentaResumen | null>(null);

  useEffect(() => {
    let cancelado = false;
    getResumenConsolidadoLegajoAction(idLegajo).then((res) => {
      if (!cancelado) setResumen(res.data ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, [idLegajo, revision]);

  return (
    <div className="flex h-full flex-col overflow-hidden p-5">
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <Landmark className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">Cuenta Corriente</h3>
      </div>

      {resumen === undefined ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : resumen === null || resumen.cuentas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este legajo no tiene cuentas de Cuenta Corriente.</p>
      ) : (
        // Padding chico acá (no en el contenedor de afuera): las Card usan
        // `ring` (box-shadow), no `border` real — sin este margen, el
        // contenedor con scroll las corta justo en el borde de sí mismo.
        <div className="flex-1 space-y-4 overflow-auto p-1">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Saldo total consolidado</p>
                <p className="text-xl font-semibold">{formatearMonto(resumen.totalCapital + resumen.totalInteres)}</p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">Capital</p>
                  <p className="font-mono text-sm font-medium">{formatearMonto(resumen.totalCapital)}</p>
                </div>
                <div>
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">Interés</p>
                  <p className="font-mono text-sm font-medium">{formatearMonto(resumen.totalInteres)}</p>
                </div>
                <div>
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">Cuentas</p>
                  <p className="text-sm font-medium">{resumen.cuentas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {resumen.cuentas.map((c) => (
              <Card key={c.idCuenta}>
                <CardHeader className="flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-mono">{c.numero}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {c.productoNombre} · Apertura {formatearFecha(c.altaFecha)}
                    </p>
                  </div>
                  {c.estadoCodigo === "abierta" ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                      {c.estadoNombre ?? "—"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{c.estadoNombre ?? "—"}</Badge>
                  )}
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Capital</p>
                      <p className="font-mono text-sm font-medium">{formatearMonto(c.saldoCapital)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Interés</p>
                      <p className="font-mono text-sm">{formatearMonto(c.saldoInteres)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Tasa</p>
                      <p className="font-mono text-sm text-muted-foreground">{c.tasaVigente}%</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCuentaAbierta(c)}>
                    Ver movimientos
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {cuentaAbierta && (
        <CuentaCorrienteDetalleDialog
          open={!!cuentaAbierta}
          onOpenChange={(open) => !open && setCuentaAbierta(null)}
          idCuenta={cuentaAbierta.idCuenta}
          numero={cuentaAbierta.numero}
        />
      )}
    </div>
  );
}
