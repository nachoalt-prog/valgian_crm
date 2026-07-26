"use client";

import { Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FiltroBandeja } from "@valgian/core";

interface BandejaFiltrosProps {
  filtros: FiltroBandeja[];
  valores: Record<string, string>;
  onChange: (campo: string, valor: string) => void;
  onSearch: () => void;
  onReset: () => void;
  loading: boolean;
}

// Radix/base-ui no admite value="" en SelectItem — "Todos" usa este sentinel,
// que se traduce a "" (sin filtro) antes de guardarlo en el estado.
const SIN_FILTRO = "__todos__";

export function BandejaFiltros({ filtros, valores, onChange, onSearch, onReset, loading }: BandejaFiltrosProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) onSearch();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
      className="space-y-4 border-b border-border bg-card px-5 py-4"
    >
      <div className="grid grid-cols-4 gap-x-4 gap-y-3">
        {filtros.map((f) => {
          if (f.tipo === "fecha_rango") {
            return (
              <div key={f.campo} className="col-span-2 flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">{f.nombre}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`${f.campo}Desde`}
                    type="date"
                    value={valores[`${f.campo}Desde`] ?? ""}
                    onChange={(e) => onChange(`${f.campo}Desde`, e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-8 text-xs"
                    aria-label={`${f.nombre} desde`}
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">a</span>
                  <Input
                    id={`${f.campo}Hasta`}
                    type="date"
                    value={valores[`${f.campo}Hasta`] ?? ""}
                    onChange={(e) => onChange(`${f.campo}Hasta`, e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-8 text-xs"
                    aria-label={`${f.nombre} hasta`}
                  />
                </div>
              </div>
            );
          }

          if (f.tipo === "select") {
            const items = {
              [SIN_FILTRO]: "Todos",
              ...Object.fromEntries((f.opciones ?? []).map((o) => [o.value, o.label])),
            };
            return (
              <div key={f.campo} className="col-span-1 flex flex-col gap-1">
                <Label htmlFor={f.campo} className="text-xs text-muted-foreground">
                  {f.nombre}
                </Label>
                <Select
                  items={items}
                  value={valores[f.campo] || SIN_FILTRO}
                  onValueChange={(v) => onChange(f.campo, v === SIN_FILTRO ? "" : (v ?? ""))}
                >
                  <SelectTrigger id={f.campo} className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_FILTRO}>Todos</SelectItem>
                    {f.opciones?.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          return (
            <div key={f.campo} className="col-span-1 flex flex-col gap-1">
              <Label htmlFor={f.campo} className="text-xs text-muted-foreground">
                {f.nombre}
              </Label>
              <Input
                id={f.campo}
                type={f.tipo === "fecha" ? "date" : "text"}
                value={valores[f.campo] ?? ""}
                onChange={(e) => onChange(f.campo, e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-xs"
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onReset} className="h-8 gap-1.5 text-xs text-muted-foreground">
          <RotateCcw className="size-3.5" />
          Limpiar
        </Button>
        <Button type="submit" size="sm" disabled={loading} className="h-8 gap-1.5 px-5 text-xs">
          <Search className="size-3.5" />
          {loading ? "Buscando…" : "Buscar"}
        </Button>
      </div>
    </form>
  );
}
