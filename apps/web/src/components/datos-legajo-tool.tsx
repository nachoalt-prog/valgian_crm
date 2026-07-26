"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { CampoTexto } from "@/components/campo-editable";
import { getLegajoDetalleAction, updateLegajoNumeroAction } from "@/app/dashboard/legajos/actions";
import type { LegajoDetalle } from "@valgian/core";

interface DatosLegajoToolProps {
  idLegajo: string;
  canGestionar: boolean;
  revision?: number;
  onCambio?: () => void;
}

function formatearFecha(fecha: Date | string | null): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleString("es-AR");
}

export function DatosLegajoTool({ idLegajo, canGestionar, revision, onCambio }: DatosLegajoToolProps) {
  const [legajo, setLegajo] = useState<LegajoDetalle | null | undefined>(undefined);

  useEffect(() => {
    let cancelado = false;
    getLegajoDetalleAction(idLegajo).then((res) => {
      if (!cancelado) setLegajo(res.data ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, [idLegajo, revision]);

  async function guardarNumero(numero: string) {
    const result = await updateLegajoNumeroAction(idLegajo, numero);
    if (!result.error) {
      setLegajo((prev) => (prev ? { ...prev, numero } : prev));
      onCambio?.();
    }
    return result;
  }

  if (legajo === undefined) {
    return <p className="p-5 text-sm text-muted-foreground">Cargando…</p>;
  }

  if (legajo === null) {
    return <p className="p-5 text-sm text-muted-foreground">No se encontró el legajo.</p>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">Datos de Legajo</h3>
      </div>

      <CampoTexto label="Número" valor={legajo.numero} editable={canGestionar} onSave={guardarNumero} />
      <CampoTexto label="Estado" valor={legajo.estadoNombre ?? "—"} editable={false} />
      <CampoTexto label="Alta" valor={`${formatearFecha(legajo.altaFecha)} — ${legajo.altaUsuarioNombre ?? "—"}`} editable={false} />
      <CampoTexto
        label="Última modificación"
        valor={`${formatearFecha(legajo.auditFecha)} — ${legajo.auditUsuarioNombre ?? "—"}`}
        editable={false}
      />
    </div>
  );
}
