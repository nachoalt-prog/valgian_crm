"use client";

import { useCallback, useState } from "react";
import { ReportesPanel } from "@/components/reportes-panel";
import { BandejaFiltros } from "@/components/bandeja-filtros";
import { ReporteResultados } from "@/components/reporte-resultados";
import { MensajeriaColaAdjuntosDialog } from "@/components/mensajeria-cola-adjuntos-dialog";
import { ProcesosEjecucionPasosDialog } from "@/components/procesos-ejecucion-pasos-dialog";
import { getReporteConfigAction, buscarReporteAction } from "@/app/dashboard/reportes/actions";
import { cn } from "@/lib/utils";
import type { ReporteResumen, ReporteConfig } from "@valgian/core";

interface ReportesToolProps {
  reportesIniciales: ReporteResumen[];
}

export function ReportesTool({ reportesIniciales }: ReportesToolProps) {
  const [selectedReporteId, setSelectedReporteId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [verAdjuntosId, setVerAdjuntosId] = useState<string | null>(null);
  const [verPasosId, setVerPasosId] = useState<string | null>(null);
  const [config, setConfig] = useState<ReporteConfig | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectReporte = useCallback(async (id: string) => {
    setSelectedReporteId(id);
    setPanelCollapsed(true);
    setFilterValues({});
    setResults([]);
    setSearched(false);
    setError(null);
    setConfig(null);
    setPagina(0);
    setHayMas(false);

    const result = await getReporteConfigAction(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConfig(result.data ?? null);
  }, []);

  const handleChange = useCallback((campo: string, valor: string) => {
    setFilterValues((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  const buscar = useCallback(
    async (reporteId: string, valores: Record<string, string>, paginaBuscada: number) => {
      setLoading(true);
      setError(null);

      const result = await buscarReporteAction(reporteId, valores, paginaBuscada);
      setLoading(false);
      setSearched(true);

      if (result.error) {
        setError(result.error);
        setResults([]);
        setHayMas(false);
        return;
      }
      setResults(result.data?.rows ?? []);
      setHayMas(result.data?.hayMas ?? false);
      setPagina(paginaBuscada);
    },
    [],
  );

  const handleSearch = useCallback(() => {
    if (!selectedReporteId) return;
    buscar(selectedReporteId, filterValues, 0);
  }, [selectedReporteId, filterValues, buscar]);

  const handleReset = useCallback(() => {
    setFilterValues({});
    setResults([]);
    setSearched(false);
    setError(null);
    setPagina(0);
    setHayMas(false);
  }, []);

  function handlePrevPage() {
    if (!selectedReporteId || pagina === 0) return;
    buscar(selectedReporteId, filterValues, pagina - 1);
  }

  function handleNextPage() {
    if (!selectedReporteId || !hayMas) return;
    buscar(selectedReporteId, filterValues, pagina + 1);
  }

  function handleExport(formato: "csv" | "tsv") {
    if (!selectedReporteId) return;
    const params = new URLSearchParams({ formato });
    for (const [campo, valor] of Object.entries(filterValues)) {
      if (valor) params.set(campo, valor);
    }
    window.open(`/api/reportes/${selectedReporteId}/export?${params.toString()}`, "_blank");
  }

  return (
    <div className="flex h-full gap-4">
      <aside
        className={cn(
          "shrink-0 overflow-hidden rounded-xl border border-border transition-all duration-200 ease-in-out",
          panelCollapsed ? "w-14" : "w-72",
        )}
      >
        <ReportesPanel
          reportes={reportesIniciales}
          selectedReporteId={selectedReporteId}
          onSelectReporte={handleSelectReporte}
          collapsed={panelCollapsed}
          onToggleCollapsed={() => setPanelCollapsed((v) => !v)}
        />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border">
        {!selectedReporteId || !config ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Elegí un reporte para buscar.
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
            <ReporteResultados
              key={selectedReporteId}
              columnas={config.columnas}
              rows={results}
              loading={loading}
              searched={searched}
              pagina={pagina}
              hayMas={hayMas}
              onPrevPage={handlePrevPage}
              onNextPage={handleNextPage}
              onExport={handleExport}
              onVerAdjuntos={(valor) => setVerAdjuntosId(String(valor))}
              onVerPasos={(valor) => setVerPasosId(String(valor))}
            />
          </>
        )}
      </div>

      {verAdjuntosId && (
        <MensajeriaColaAdjuntosDialog open={!!verAdjuntosId} onOpenChange={(o) => !o && setVerAdjuntosId(null)} idMensajeriaCola={verAdjuntosId} />
      )}

      {verPasosId && (
        <ProcesosEjecucionPasosDialog open={!!verPasosId} onOpenChange={(o) => !o && setVerPasosId(null)} idEjecucion={verPasosId} />
      )}
    </div>
  );
}
