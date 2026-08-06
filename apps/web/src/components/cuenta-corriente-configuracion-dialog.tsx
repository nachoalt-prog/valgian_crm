"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CampoTexto } from "@/components/campo-editable";
import { getTasaHistoricoCuentaAction, actualizarTasaCuentaAction } from "@/app/dashboard/cuenta-corriente/actions";
import type { XccTasaHistoricoFila } from "@valgian/module-cuenta-corriente";

interface CuentaCorrienteConfiguracionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idCuenta: string;
  numero: string;
  tasaActual: number;
  editable: boolean;
  onGuardado: () => void;
}

function formatearFecha(fecha: Date | string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Configuración de una cuenta XCC — hoy solo la tasa de interés, el único
 * campo que el motor realmente usa. SALDO_MIN_INTERES/GASTO_MENSUAL/
 * SALDO_MIN_GASTO_MENSUAL existen en XCC_CUENTAS pero ningún .sql del módulo
 * los lee todavía (ver docs/domain/cuenta-corriente.md) — no se exponen acá
 * para no mostrar controles que no hacen nada.
 */
export function CuentaCorrienteConfiguracionDialog({
  open,
  onOpenChange,
  idCuenta,
  numero,
  tasaActual,
  editable,
  onGuardado,
}: CuentaCorrienteConfiguracionDialogProps) {
  const [historico, setHistorico] = useState<XccTasaHistoricoFila[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setHistorico(null);
    getTasaHistoricoCuentaAction(idCuenta).then((res) => {
      if (!cancelado) setHistorico(res.data ?? []);
    });
    return () => {
      cancelado = true;
    };
  }, [open, idCuenta]);

  async function guardarTasa(valor: string) {
    const nuevaTasa = Number(valor.replace(",", "."));
    if (!valor.trim() || Number.isNaN(nuevaTasa) || nuevaTasa <= 0) {
      return { error: "Ingresá un número mayor a 0." };
    }
    const result = await actualizarTasaCuentaAction(idCuenta, nuevaTasa);
    if (result.error) return { error: result.error };

    onGuardado();
    const refreshed = await getTasaHistoricoCuentaAction(idCuenta);
    setHistorico(refreshed.data ?? []);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{numero} — Configuración</DialogTitle>
        </DialogHeader>

        <CampoTexto label="Tasa de interés (% anual)" valor={String(tasaActual)} editable={editable} onSave={guardarTasa} />

        <div>
          <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Histórico de tasas</p>
          {historico === null ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {historico.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-mono">{h.tasa}%</span>
                  <span className="text-xs text-muted-foreground">{formatearFecha(h.vigenteDesde)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
