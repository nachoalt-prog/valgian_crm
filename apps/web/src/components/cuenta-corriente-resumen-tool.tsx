"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Percent, Settings, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CuentaCorrienteDetalleDialog } from "@/components/cuenta-corriente-detalle-dialog";
import { CuentaCorrienteConfiguracionDialog } from "@/components/cuenta-corriente-configuracion-dialog";
import { CuentaCorrienteGestionDialog } from "@/components/cuenta-corriente-gestion-dialog";
import { CuentaCorrienteCondicionClienteDialog } from "@/components/cuenta-corriente-condicion-cliente-dialog";
import { getResumenConsolidadoLegajoAction, getEntidadCuentaAction, getPermisosCuentaCorrienteAction } from "@/app/dashboard/cuenta-corriente/actions";
import type { XccCuentaResumen } from "@valgian/module-cuenta-corriente";

interface CuentaCorrienteResumenToolProps {
  idLegajo: string;
  // Herramienta de solo lectura a nivel solapa — no tiene acciones que gatear
  // acá, pero recibe la prop igual que el resto de las herramientas embebibles
  // (LegajoHerramientaProps). Configuración/Gestión por cuenta tienen su
  // propio permiso independiente, resuelto abajo.
  canGestionar?: boolean;
  revision?: number;
}

type Resumen = { cuentas: XccCuentaResumen[]; totalCapital: number; totalInteres: number };

interface PermisosCuentaCorriente {
  verConfig: boolean;
  editarConfig: boolean;
  verGestion: boolean;
  gestionar: boolean;
  verCondicionCliente: boolean;
  editarCondicionCliente: boolean;
}

const PERMISOS_DEFAULT: PermisosCuentaCorriente = {
  verConfig: false,
  editarConfig: false,
  verGestion: false,
  gestionar: false,
  verCondicionCliente: false,
  editarCondicionCliente: false,
};

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
  const [idEntidadCuenta, setIdEntidadCuenta] = useState<string | null>(null);
  const [permisos, setPermisos] = useState<PermisosCuentaCorriente>(PERMISOS_DEFAULT);
  const [cuentaAbierta, setCuentaAbierta] = useState<XccCuentaResumen | null>(null);
  const [configuracionAbierta, setConfiguracionAbierta] = useState<XccCuentaResumen | null>(null);
  const [gestionAbierta, setGestionAbierta] = useState<XccCuentaResumen | null>(null);
  const [condicionClienteAbierta, setCondicionClienteAbierta] = useState(false);

  const refrescar = useCallback(() => {
    getResumenConsolidadoLegajoAction(idLegajo).then((res) => setResumen(res.data ?? null));
  }, [idLegajo]);

  useEffect(() => {
    let cancelado = false;
    getResumenConsolidadoLegajoAction(idLegajo).then((res) => {
      if (!cancelado) setResumen(res.data ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, [idLegajo, revision]);

  // Independiente de idLegajo/revision — es el mismo dato para toda la sesión.
  useEffect(() => {
    let cancelado = false;
    getEntidadCuentaAction().then((res) => {
      if (!cancelado) setIdEntidadCuenta(res.data ?? null);
    });
    getPermisosCuentaCorrienteAction().then((res) => {
      if (!cancelado) setPermisos(res.data ?? PERMISOS_DEFAULT);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden p-5">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Landmark className="size-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">Cuenta Corriente</h3>
        </div>
        {permisos.verCondicionCliente && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-primary"
            aria-label="Condición impositiva del cliente"
            onClick={() => setCondicionClienteAbierta(true)}
          >
            <Percent className="size-3.5" />
          </Button>
        )}
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
                  <div className="flex items-center gap-1">
                    {permisos.verConfig && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-primary"
                        aria-label="Configuración de la cuenta"
                        onClick={() => setConfiguracionAbierta(c)}
                      >
                        <Settings className="size-3.5" />
                      </Button>
                    )}
                    {permisos.verGestion && idEntidadCuenta && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-primary"
                        aria-label="Gestionar la cuenta"
                        onClick={() => setGestionAbierta(c)}
                      >
                        <Zap className="size-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setCuentaAbierta(c)}>
                      Ver movimientos
                    </Button>
                  </div>
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

      {configuracionAbierta && (
        <CuentaCorrienteConfiguracionDialog
          open={!!configuracionAbierta}
          onOpenChange={(open) => !open && setConfiguracionAbierta(null)}
          idCuenta={configuracionAbierta.idCuenta}
          numero={configuracionAbierta.numero}
          tasaActual={configuracionAbierta.tasaVigente}
          editable={permisos.editarConfig}
          onGuardado={refrescar}
        />
      )}

      {gestionAbierta && idEntidadCuenta && (
        <CuentaCorrienteGestionDialog
          open={!!gestionAbierta}
          onOpenChange={(open) => !open && setGestionAbierta(null)}
          idCuenta={gestionAbierta.idCuenta}
          numero={gestionAbierta.numero}
          idEntidad={idEntidadCuenta}
          gestionar={permisos.gestionar}
          onCambio={refrescar}
        />
      )}

      <CuentaCorrienteCondicionClienteDialog
        open={condicionClienteAbierta}
        onOpenChange={setCondicionClienteAbierta}
        idLegajo={idLegajo}
        editable={permisos.editarCondicionCliente}
      />
    </div>
  );
}
