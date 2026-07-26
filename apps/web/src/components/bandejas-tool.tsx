"use client";

import { useCallback, useState } from "react";
import { BandejasPanel } from "@/components/bandejas-panel";
import { BandejaFiltros } from "@/components/bandeja-filtros";
import { BandejaResultados } from "@/components/bandeja-resultados";
import { LegajoLayoutModal } from "@/components/legajo-layout-modal";
import { getBandejaConfigAction, buscarBandejaAction } from "@/app/dashboard/bandejas/actions";
import type { BandejaResumen, BandejaConfig } from "@valgian/core";

interface BandejasToolProps {
  bandejasIniciales: BandejaResumen[];
}

export function BandejasTool({ bandejasIniciales }: BandejasToolProps) {
  const [selectedBandejaId, setSelectedBandejaId] = useState<string | null>(null);
  const [config, setConfig] = useState<BandejaConfig | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [legajoAbierto, setLegajoAbierto] = useState<string | null>(null);

  const handleSelectBandeja = useCallback(async (id: string) => {
    setSelectedBandejaId(id);
    setFilterValues({});
    setResults([]);
    setSearched(false);
    setError(null);
    setConfig(null);

    const result = await getBandejaConfigAction(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConfig(result.data ?? null);
  }, []);

  const handleChange = useCallback((campo: string, valor: string) => {
    setFilterValues((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  const handleSearch = useCallback(async () => {
    if (!selectedBandejaId) return;
    setLoading(true);
    setError(null);

    const result = await buscarBandejaAction(selectedBandejaId, filterValues);
    setLoading(false);
    setSearched(true);

    if (result.error) {
      setError(result.error);
      setResults([]);
      return;
    }
    setResults(result.data ?? []);
  }, [selectedBandejaId, filterValues]);

  const handleReset = useCallback(() => {
    setFilterValues({});
    setResults([]);
    setSearched(false);
    setError(null);
  }, []);

  function handleOpen(row: Record<string, unknown>) {
    const id = row.id;
    if (typeof id !== "string") {
      setAviso("No se pudo abrir: la fila no tiene ID.");
      setTimeout(() => setAviso(null), 3500);
      return;
    }
    setLegajoAbierto(id);
  }

  return (
    <div className="flex h-full gap-4">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-lg">
          {aviso}
        </div>
      )}

      <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-border">
        <BandejasPanel bandejas={bandejasIniciales} selectedBandejaId={selectedBandejaId} onSelectBandeja={handleSelectBandeja} />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border">
        {!selectedBandejaId || !config ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Elegí una bandeja para buscar.
          </div>
        ) : (
          <>
            <BandejaFiltros
              filtros={config.filtros}
              valores={filterValues}
              onChange={handleChange}
              onSearch={handleSearch}
              onReset={handleReset}
              loading={loading}
            />
            {error && <p className="border-b border-border px-5 py-2 text-sm text-destructive">{error}</p>}
            <BandejaResultados
              key={selectedBandejaId}
              columnas={config.columnas}
              rows={results}
              loading={loading}
              searched={searched}
              onOpen={handleOpen}
            />
          </>
        )}
      </div>

      {legajoAbierto && selectedBandejaId && (
        <LegajoLayoutModal
          open={!!legajoAbierto}
          onOpenChange={(o) => {
            if (!o) setLegajoAbierto(null);
          }}
          bandejaId={selectedBandejaId}
          legajoId={legajoAbierto}
        />
      )}
    </div>
  );
}
