"use client";

import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BandejaResumen } from "@valgian/core";

interface BandejasPanelProps {
  bandejas: BandejaResumen[];
  selectedBandejaId: string | null;
  onSelectBandeja: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function BandejasPanel({ bandejas, selectedBandejaId, onSelectBandeja, collapsed, onToggleCollapsed }: BandejasPanelProps) {
  if (collapsed) {
    return (
      <section className="flex h-full flex-col items-center gap-2 bg-card/50 py-4">
        <Inbox className="size-4 text-primary" />
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label="Expandir bandejas"
                className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
            }
          />
          <TooltipContent side="right" className="text-xs">
            Expandir bandejas
          </TooltipContent>
        </Tooltip>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col bg-card/50">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Inbox className="size-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Bandejas</h2>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Colapsar bandejas"
          className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {bandejas.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-muted-foreground">
            No tenés bandejas asignadas a tu perfil.
          </li>
        )}
        {bandejas.map((b) => {
          const isSelected = selectedBandejaId === b.id;
          return (
            <li
              key={b.id}
              onClick={() => onSelectBandeja(b.id)}
              className={`cursor-pointer border-l-2 px-5 py-3.5 transition-colors ${
                isSelected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/60"
              }`}
            >
              <div className="mb-0.5 flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">[{b.codigo}]</span>
              </div>
              <span className="truncate text-sm font-medium text-foreground">{b.nombre}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
