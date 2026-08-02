"use client";

import { BarChart3 } from "lucide-react";
import type { ReporteResumen } from "@valgian/core";

interface ReportesPanelProps {
  reportes: ReporteResumen[];
  selectedReporteId: string | null;
  onSelectReporte: (id: string) => void;
}

export function ReportesPanel({ reportes, selectedReporteId, onSelectReporte }: ReportesPanelProps) {
  const grupos = new Map<string, ReporteResumen[]>();
  for (const r of reportes) {
    const clave = r.categoriaNombre ?? "Sin categoría";
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(r);
  }

  return (
    <section className="flex h-full flex-col bg-card/50">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <BarChart3 className="size-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Reportes</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {reportes.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No tenés reportes asignados a tu perfil.</p>
        )}
        {Array.from(grupos.entries()).map(([categoria, items]) => (
          <div key={categoria}>
            <p className="px-5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{categoria}</p>
            <ul className="divide-y divide-border">
              {items.map((r) => {
                const isSelected = selectedReporteId === r.id;
                return (
                  <li
                    key={r.id}
                    onClick={() => onSelectReporte(r.id)}
                    className={`cursor-pointer border-l-2 px-5 py-3.5 transition-colors ${
                      isSelected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/60"
                    }`}
                  >
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">[{r.codigo}]</span>
                    </div>
                    <span className="truncate text-sm font-medium text-foreground">{r.nombre}</span>
                    {r.descripcion && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.descripcion}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
