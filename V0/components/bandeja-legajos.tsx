'use client'

import { useState, useCallback } from 'react'
import { BandejaFiltros } from '@/components/bandeja-filtros'
import { BandejaResultados } from '@/components/bandeja-resultados'
import { Legajo, LegajoFilters } from '@/lib/bandeja-types'
import {
  LEGAJO_FILTERS,
  LEGAJO_COLUMNS,
  searchLegajos,
} from '@/lib/legajos-mock'

const EMPTY_FILTERS: LegajoFilters = {
  nroLegajo: '',
  titular: '',
  nroDocumento: '',
  estado: '',
  sectorial: '',
  fechaDesde: '',
  fechaHasta: '',
}

// Mapeo de keys del FilterDef → keys del objeto LegajoFilters
// Para daterange el FilterDef tiene key='fechaIngreso' y genera 'fechaIngresoDesde'/'fechaIngresoHasta'
// que coinciden con los campos del tipo LegajoFilters (fechaDesde / fechaHasta).
// Lo resolvemos con una función de traducción.
function filterValuesToLegajoFilters(values: Record<string, string>): LegajoFilters {
  return {
    nroLegajo:   values['nroLegajo']         ?? '',
    titular:     values['titular']            ?? '',
    nroDocumento: values['nroDocumento']     ?? '',
    estado:      values['estado'] === '__all__' ? '' : (values['estado'] ?? ''),
    sectorial:   values['sectorial'] === '__all__' ? '' : (values['sectorial'] ?? ''),
    fechaDesde:  values['fechaIngresoDesde'] ?? '',
    fechaHasta:  values['fechaIngresoHasta'] ?? '',
  }
}

export function BandejaLegajos() {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Legajo[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleChange = useCallback((key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSearch = useCallback(() => {
    setLoading(true)
    // Simula latencia de red
    setTimeout(() => {
      const mapped = filterValuesToLegajoFilters(filterValues)
      setResults(searchLegajos(mapped))
      setSearched(true)
      setLoading(false)
    }, 450)
  }, [filterValues])

  const handleReset = useCallback(() => {
    setFilterValues({})
    setResults([])
    setSearched(false)
  }, [])

  const handleOpen = useCallback((row: Legajo) => {
    // Hook para integrar desde el sitio padre
    alert(`Abriendo legajo: ${row.nroLegajo} — ${row.titular}`)
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-6 py-3.5 border-b border-border bg-card">
        <div className="w-7 h-7 shrink-0">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <polygon
              points="16,2 30,10 30,22 16,30 2,22 2,10"
              stroke="currentColor" strokeWidth="1.5" fill="none"
              className="text-primary/30"
            />
            <polyline
              points="4,8 16,26 28,8"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className="text-primary"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-widest uppercase text-foreground">Valgian CRM</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Bandeja de Legajos
          </p>
        </div>
        {searched && !loading && (
          <div className="ml-auto">
            <span className="text-xs text-muted-foreground">
              {results.length} resultado{results.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </header>

      {/* Filters */}
      <BandejaFiltros
        filters={LEGAJO_FILTERS}
        values={filterValues}
        onChange={handleChange}
        onSearch={handleSearch}
        onReset={handleReset}
        loading={loading}
      />

      {/* Results */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <BandejaResultados
          columns={LEGAJO_COLUMNS}
          rows={results}
          loading={loading}
          searched={searched}
          onOpen={handleOpen}
          estadoKey="estado"
        />
      </main>
    </div>
  )
}
