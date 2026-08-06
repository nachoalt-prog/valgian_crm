"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CampoSelect } from "@/components/campo-editable";
import {
  getTitularCondicionImpositivaAction,
  listCondicionesImpositivasDisponiblesAction,
  actualizarCondicionImpositivaClienteAction,
  listCondicionHistoricoClienteAction,
} from "@/app/dashboard/cuenta-corriente/actions";
import type { XccTitularCondicion, XccCondicionHistoricoFila } from "@valgian/module-cuenta-corriente";

interface CuentaCorrienteCondicionClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idLegajo: string;
  editable: boolean;
}

function formatearFecha(fecha: Date | string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Condición impositiva del titular del legajo — dato del CLIENTE, no de una
 * cuenta puntual (ver docs/domain/cuenta-corriente.md). El motor la resuelve
 * vía XCC_CLIENTES_CONDICION_HISTORICO para calcular la retención de
 * Ganancias; acá se administra el vínculo que antes solo existía en datos demo.
 */
export function CuentaCorrienteCondicionClienteDialog({ open, onOpenChange, idLegajo, editable }: CuentaCorrienteCondicionClienteDialogProps) {
  const [titular, setTitular] = useState<XccTitularCondicion | null | undefined>(undefined);
  const [opciones, setOpciones] = useState<{ value: string; label: string }[]>([]);
  const [historico, setHistorico] = useState<XccCondicionHistoricoFila[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setTitular(undefined);
    setHistorico(null);

    getTitularCondicionImpositivaAction(idLegajo).then((res) => {
      if (cancelado) return;
      setTitular(res.data ?? null);
      if (res.data) {
        listCondicionHistoricoClienteAction(res.data.idCliente).then((h) => {
          if (!cancelado) setHistorico(h.data ?? []);
        });
      }
    });
    listCondicionesImpositivasDisponiblesAction().then((res) => {
      if (!cancelado) setOpciones((res.data ?? []).map((c) => ({ value: c.id, label: c.nombre })));
    });

    return () => {
      cancelado = true;
    };
  }, [open, idLegajo]);

  async function guardarCondicion(idCondicionImpositiva: string) {
    if (!titular) return { error: "No hay titular cargado." };
    const result = await actualizarCondicionImpositivaClienteAction(titular.idCliente, idCondicionImpositiva);
    if (result.error) return { error: result.error };

    const [refreshedTitular, refreshedHistorico] = await Promise.all([
      getTitularCondicionImpositivaAction(idLegajo),
      listCondicionHistoricoClienteAction(titular.idCliente),
    ]);
    setTitular(refreshedTitular.data ?? null);
    setHistorico(refreshedHistorico.data ?? []);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Condición Impositiva del Cliente</DialogTitle>
        </DialogHeader>

        {titular === undefined ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : titular === null ? (
          <p className="text-sm text-muted-foreground">Este legajo no tiene un titular cargado todavía.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{titular.clienteNombre}</p>

            <CampoSelect
              label="Condición Impositiva"
              valorId={titular.idCondicionImpositiva}
              valorLabel={titular.condicionNombre ?? "Sin asignar"}
              opciones={opciones}
              editable={editable}
              onSave={guardarCondicion}
            />

            <div>
              <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Histórico</p>
              {historico === null ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              ) : historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {historico.map((h) => (
                    <li key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{h.condicionNombre ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{formatearFecha(h.vigenteDesde)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
