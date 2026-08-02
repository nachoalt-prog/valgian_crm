"use client";

import { useCallback, useState } from "react";
import { BandejasPanel } from "@/components/bandejas-panel";
import { BandejaFiltros } from "@/components/bandeja-filtros";
import { BandejaResultados } from "@/components/bandeja-resultados";
import { LegajoLayoutModal } from "@/components/legajo-layout-modal";
import { TramiteModal } from "@/components/tramite-modal";
import { getBandejaConfigAction, buscarBandejaAction } from "@/app/dashboard/bandejas/actions";
import { getPermisoTramitesAction } from "@/app/dashboard/tramites/actions";
import { cn } from "@/lib/utils";
import type { BandejaResumen, BandejaConfig } from "@valgian/core";

interface TramiteAbierto {
  idTramite: string;
  idTipoTramite: string;
  idRegistro: string;
}

interface BandejasToolProps {
  bandejasIniciales: BandejaResumen[];
}

export function BandejasTool({ bandejasIniciales }: BandejasToolProps) {
  const [selectedBandejaId, setSelectedBandejaId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [config, setConfig] = useState<BandejaConfig | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [legajoAbierto, setLegajoAbierto] = useState<string | null>(null);
  const [tramiteAbierto, setTramiteAbierto] = useState<TramiteAbierto | null>(null);
  const [canGestionarTramites, setCanGestionarTramites] = useState(false);

  const handleSelectBandeja = useCallback(async (id: string) => {
    setSelectedBandejaId(id);
    setPanelCollapsed(true);
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
    if (result.data?.tipoApertura === "tramite") {
      getPermisoTramitesAction().then((res) => setCanGestionarTramites(res.data));
    }
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

    if (config?.tipoApertura === "tramite") {
      const idTipoTramite = row.tipo_tramite_id;
      if (typeof idTipoTramite !== "string") {
        setAviso("No se pudo abrir: la fila no tiene tipo_tramite_id.");
        setTimeout(() => setAviso(null), 3500);
        return;
      }
      const idRegistro = row.registro_id;
      setTramiteAbierto({ idTramite: id, idTipoTramite, idRegistro: typeof idRegistro === "string" ? idRegistro : "" });
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

      <aside
        className={cn(
          "shrink-0 overflow-hidden rounded-xl border border-border transition-all duration-200 ease-in-out",
          panelCollapsed ? "w-14" : "w-72",
        )}
      >
        <BandejasPanel
          bandejas={bandejasIniciales}
          selectedBandejaId={selectedBandejaId}
          onSelectBandeja={handleSelectBandeja}
          collapsed={panelCollapsed}
          onToggleCollapsed={() => setPanelCollapsed((v) => !v)}
        />
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

      {tramiteAbierto && (
        <TramiteModal
          key={tramiteAbierto.idTramite}
          open={!!tramiteAbierto}
          onOpenChange={(o) => {
            if (!o) setTramiteAbierto(null);
          }}
          idTipoTramite={tramiteAbierto.idTipoTramite}
          idRegistro={tramiteAbierto.idRegistro}
          idTramite={tramiteAbierto.idTramite}
          canGestionar={canGestionarTramites}
          onGestionado={handleSearch}
        />
      )}
    </div>
  );
}
