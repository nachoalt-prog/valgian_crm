"use client";

import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getLayoutParaBandejaAction } from "@/app/dashboard/bandejas/actions";
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
    return () => {
      cancelado = true;
    };
  }, [bandejaId]);

  const solapaActiva = layout?.solapas.find((s) => s.id === activeSolapaId) ?? null;
  const Herramienta = solapaActiva?.herramientaCodigo ? LEGAJO_HERRAMIENTAS[solapaActiva.herramientaCodigo] : null;

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

            <div className="flex-1 overflow-hidden border-t border-border">
              {!solapaActiva || !solapaActiva.herramientaCodigo ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin configurar.</div>
              ) : Herramienta ? (
                <Herramienta idLegajo={legajoId} canGestionar={solapaActiva.canGestionar} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-destructive">
                  Herramienta &quot;{solapaActiva.herramientaCodigo}&quot; no registrada en el frontend.
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
