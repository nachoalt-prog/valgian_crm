// ─── Bandeja: tipos genéricos ──────────────────────────────────────────────

export type FilterType = 'text' | 'select' | 'date' | 'daterange'

export interface SelectOption {
  value: string
  label: string
}

export interface FilterDef {
  key: string
  label: string
  type: FilterType
  placeholder?: string
  options?: SelectOption[]   // solo para type === 'select'
  span?: 1 | 2              // columnas que ocupa en la grilla de filtros
}

export interface ColumnDef<T = Record<string, unknown>> {
  key: keyof T | string
  label: string
  width?: string            // clase Tailwind para el ancho de la celda
  render?: (row: T) => React.ReactNode
}

// ─── Legajos ──────────────────────────────────────────────────────────────

export interface Legajo {
  id: string
  nroLegajo: string
  titular: string
  tipoDocumento: string
  nroDocumento: string
  estado: 'Activo' | 'Inactivo' | 'Observado' | 'Cerrado'
  sectorial: string
  fechaIngreso: string      // ISO date string
  ultimaActualizacion: string
}

export interface LegajoFilters {
  nroLegajo: string
  titular: string
  nroDocumento: string
  estado: string
  sectorial: string
  fechaDesde: string
  fechaHasta: string
}
