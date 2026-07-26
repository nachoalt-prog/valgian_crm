"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getLayoutParaBandejaAction } from "@/app/dashboard/bandejas/actions";
import { getEntidadLegajoAction } from "@/app/dashboard/legajos/actions";
import { LEGAJO_HERRAMIENTAS } from "@/lib/legajo-herramientas";
import type { LayoutLegajo } from "@valgian/core";

interface LegajoLayoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandejaId: string;
  legajoId: string;
}

export function LegajoLayoutModal({ open, onOpenChange, bandejaId, legajoId }: LegajoLayoutModalProps) {
  const [layout, setLayout] = useState<LayoutLegajo | null | undefined>(undefined);
  const [activeSolapaId, setActiveSolapaId] = useState<string | null>(null);
  const [idEntidad, setIdEntidad] = useState<string | undefined>(undefined);
  const [revision, setRevision] = useState(0);
  const bumpRevision = useCallback(() => setRevision((r) => r + 1), []);

  // El padre monta este componente recién cuando hay que abrirlo (ver
  // bandejas-tool.tsx), así que el estado ya arranca limpio en `undefined` sin
  // necesidad de resetearlo a mano acá.
  useEffect(() => {
    let cancelado = false;
    getLayoutParaBandejaAction(bandejaId).then((res) => {
      if (cancelado) return;
      const data = res.data ?? null;
      setLayout(data);
      setActiveSolapaId(data?.solapas[0]?.id ?? null);
    });
    getEntidadLegajoAction().then((res) => {
      if (!cancelado) setIdEntidad(res.data ?? undefined);
    });
    return () => {
      cancelado = true;
    };
  }, [bandejaId]);

  const solapaActiva = layout?.solapas.find((s) => s.id === activeSolapaId) ?? null;
  const solapasConHerramienta = layout?.solapas.filter((s) => s.herramientaCodigo) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-5xl! flex-col gap-0 p-0">
        {layout === undefined ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Cargando…</div>
        ) : layout === null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Inbox className="size-8 opacity-30" />
            <p className="text-sm">No hay un layout configurado para esta bandeja.</p>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 gap-1 border-b border-border px-4 pt-4">
              {layout.solapas.map((s) => {
                const activa = s.id === activeSolapaId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSolapaId(s.id)}
                    className={cn(
                      "-mb-px rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium transition-colors",
                      activa
                        ? "border-border bg-popover text-foreground"
                        : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    {s.nombre}
                  </button>
                );
              })}
            </div>

            <div className="relative flex-1 overflow-hidden border-t border-border">
              {solapaActiva && !solapaActiva.herramientaCodigo && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin configurar.</div>
              )}
              {/* Todas las solapas con herramienta quedan montadas desde que se resuelve el
                  layout — se ocultan con CSS al cambiar de pestaña, no se desmontan, así cada
                  una fetchea sus datos una única vez (ver LegajoHerramientaProps.revision). */}
              {solapasConHerramienta.map((s) => {
                const activa = s.id === activeSolapaId;
                const HerramientaSolapa = LEGAJO_HERRAMIENTAS[s.herramientaCodigo!];
                return (
                  <div key={s.id} className={cn("absolute inset-0", activa ? "block" : "hidden")}>
                    {HerramientaSolapa ? (
                      <HerramientaSolapa
                        idLegajo={legajoId}
                        idEntidad={idEntidad}
                        canGestionar={s.canGestionar}
                        revision={revision}
                        onCambio={bumpRevision}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-destructive">
                        Herramienta &quot;{s.herramientaCodigo}&quot; no registrada en el frontend.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
