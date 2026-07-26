"use client";

import { useEffect, useState } from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEstimulosDisponiblesAction, aplicarEstimuloAction } from "@/app/dashboard/gestion-entidad/actions";
import type { EstimulosDisponiblesResult } from "@valgian/core";

interface GestionEntidadToolProps {
  idLegajo: string;
  idEntidad?: string;
  canGestionar: boolean;
  onCambio?: () => void;
}

export function GestionEntidadTool({ idLegajo, idEntidad, canGestionar, onCambio }: GestionEntidadToolProps) {
  const [datos, setDatos] = useState<EstimulosDisponiblesResult | null | undefined>(undefined);
  const [idEstimulo, setIdEstimulo] = useState<string | null>(null);
  const [observacion, setObservacion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    if (!idEntidad) return;
    let cancelado = false;
    getEstimulosDisponiblesAction(idEntidad, idLegajo).then((result) => {
      if (cancelado) return;
      setDatos(result.data ?? null);
      setIdEstimulo(null);
    });
    return () => {
      cancelado = true;
    };
  }, [idEntidad, idLegajo]);

  async function handleGestionar() {
    if (!idEntidad || !idEstimulo) return;
    setPending(true);
    setError(null);
    setExito(null);
    const result = await aplicarEstimuloAction(idEntidad, idLegajo, idEstimulo, observacion);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setExito("Estímulo aplicado correctamente.");
    setObservacion("");
    const refreshed = await getEstimulosDisponiblesAction(idEntidad, idLegajo);
    setDatos(refreshed.data ?? null);
    setIdEstimulo(null);
    onCambio?.();
  }

  if (datos === undefined) {
    return <p className="p-5 text-sm text-muted-foreground">Cargando…</p>;
  }

  if (datos === null || !datos.estadoActual) {
    return <p className="p-5 text-sm text-muted-foreground">No se encontró el estado actual del registro.</p>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">Gestión de Entidad</h3>
      </div>

      <div className="mb-4 flex flex-col gap-1 border-b border-border pb-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Estado actual</span>
        <span className="text-sm font-medium text-foreground">{datos.estadoActual.nombre}</span>
      </div>

      <div className="mb-4 flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Estímulo</label>
        {datos.estimulos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tenés estímulos disponibles para aplicar desde este estado.</p>
        ) : (
          <Select
            items={Object.fromEntries(datos.estimulos.map((e) => [e.id, e.nombre]))}
            value={idEstimulo ?? undefined}
            onValueChange={(v) => setIdEstimulo(v ?? null)}
            disabled={!canGestionar}
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

      <div className="mb-4 flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Observación</label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          disabled={!canGestionar}
          rows={6}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
      </div>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      {exito && (
        <p className="mb-2 flex items-center gap-1.5 text-sm text-emerald-500">
          <CheckCircle2 className="size-3.5" />
          {exito}
        </p>
      )}

      <div>
        <Button onClick={handleGestionar} disabled={!canGestionar || !idEstimulo || pending}>
          {pending ? "Gestionando…" : "Gestionar"}
        </Button>
        {!canGestionar && <p className="mt-2 text-xs text-muted-foreground">Tu perfil no tiene permiso de gestión sobre esta herramienta.</p>}
      </div>
    </div>
  );
}
