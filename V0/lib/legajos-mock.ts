import { Legajo, LegajoFilters, FilterDef, ColumnDef } from './bandeja-types'
import { format } from 'date-fns'

// ─── Datos mock ────────────────────────────────────────────────────────────

export const MOCK_LEGAJOS: Legajo[] = [
  { id: '1',  nroLegajo: 'LEG-00142', titular: 'Rodríguez, María Elena',    tipoDocumento: 'DNI', nroDocumento: '28.441.190', estado: 'Activo',    sectorial: 'Recursos Humanos', fechaIngreso: '2019-03-15', ultimaActualizacion: '2024-11-02' },
  { id: '2',  nroLegajo: 'LEG-00089', titular: 'Giménez, Carlos Alberto',   tipoDocumento: 'DNI', nroDocumento: '22.007.834', estado: 'Inactivo',  sectorial: 'Contabilidad',     fechaIngreso: '2015-07-01', ultimaActualizacion: '2023-05-18' },
  { id: '3',  nroLegajo: 'LEG-00201', titular: 'Fernández, Lucía Paz',      tipoDocumento: 'DNI', nroDocumento: '35.892.441', estado: 'Activo',    sectorial: 'Sistemas',         fechaIngreso: '2021-09-20', ultimaActualizacion: '2025-01-30' },
  { id: '4',  nroLegajo: 'LEG-00057', titular: 'Morales, Javier Ernesto',   tipoDocumento: 'CUIL', nroDocumento: '20-19334872-5', estado: 'Observado', sectorial: 'Legales',       fechaIngreso: '2012-02-10', ultimaActualizacion: '2024-08-14' },
  { id: '5',  nroLegajo: 'LEG-00318', titular: 'Peralta, Valentina Sol',    tipoDocumento: 'DNI', nroDocumento: '40.112.007', estado: 'Activo',    sectorial: 'Recursos Humanos', fechaIngreso: '2023-01-09', ultimaActualizacion: '2025-02-11' },
  { id: '6',  nroLegajo: 'LEG-00174', titular: 'Suárez, Diego Hernán',      tipoDocumento: 'Pasaporte', nroDocumento: 'AAB114892', estado: 'Cerrado',   sectorial: 'Dirección',    fechaIngreso: '2017-06-28', ultimaActualizacion: '2022-12-01' },
  { id: '7',  nroLegajo: 'LEG-00263', titular: 'López, Andrea Giselle',     tipoDocumento: 'DNI', nroDocumento: '31.558.923', estado: 'Activo',    sectorial: 'Contabilidad',     fechaIngreso: '2020-11-03', ultimaActualizacion: '2025-03-05' },
  { id: '8',  nroLegajo: 'LEG-00095', titular: 'Castro, Roberto Fabián',    tipoDocumento: 'CUIL', nroDocumento: '23-25887340-9', estado: 'Inactivo', sectorial: 'Sistemas',      fechaIngreso: '2016-04-17', ultimaActualizacion: '2023-10-22' },
  { id: '9',  nroLegajo: 'LEG-00337', titular: 'Villalba, Natalia Carmen',  tipoDocumento: 'DNI', nroDocumento: '42.001.558', estado: 'Activo',    sectorial: 'Legales',          fechaIngreso: '2024-02-01', ultimaActualizacion: '2025-04-08' },
  { id: '10', nroLegajo: 'LEG-00128', titular: 'Ponce, Gabriel Alejandro',  tipoDocumento: 'DNI', nroDocumento: '29.774.312', estado: 'Observado', sectorial: 'Dirección',        fechaIngreso: '2018-08-25', ultimaActualizacion: '2024-07-30' },
  { id: '11', nroLegajo: 'LEG-00049', titular: 'Aguirre, Silvia Beatriz',   tipoDocumento: 'DNI', nroDocumento: '18.334.002', estado: 'Cerrado',   sectorial: 'Recursos Humanos', fechaIngreso: '2005-01-12', ultimaActualizacion: '2021-03-15' },
  { id: '12', nroLegajo: 'LEG-00289', titular: 'Torres, Matías Ignacio',    tipoDocumento: 'CUIL', nroDocumento: '20-37441021-3', estado: 'Activo', sectorial: 'Contabilidad',    fechaIngreso: '2022-05-30', ultimaActualizacion: '2025-01-14' },
  { id: '13', nroLegajo: 'LEG-00221', titular: 'Herrera, Florencia Anahí',  tipoDocumento: 'DNI', nroDocumento: '33.620.887', estado: 'Activo',    sectorial: 'Sistemas',         fechaIngreso: '2021-03-08', ultimaActualizacion: '2025-05-02' },
  { id: '14', nroLegajo: 'LEG-00066', titular: 'Núñez, Osvaldo Miguel',     tipoDocumento: 'DNI', nroDocumento: '14.009.776', estado: 'Inactivo',  sectorial: 'Legales',          fechaIngreso: '2009-10-19', ultimaActualizacion: '2020-06-30' },
  { id: '15', nroLegajo: 'LEG-00355', titular: 'Ruiz, Camila Belén',        tipoDocumento: 'DNI', nroDocumento: '44.887.103', estado: 'Activo',    sectorial: 'Dirección',        fechaIngreso: '2024-09-01', ultimaActualizacion: '2025-04-20' },
]

// ─── Definición de filtros para Legajos ────────────────────────────────────

export const LEGAJO_FILTERS: FilterDef[] = [
  {
    key: 'nroLegajo',
    label: 'Nro. Legajo',
    type: 'text',
    placeholder: 'Ej: LEG-00142',
  },
  {
    key: 'titular',
    label: 'Titular',
    type: 'text',
    placeholder: 'Nombre o apellido…',
    span: 2,
  },
  {
    key: 'nroDocumento',
    label: 'Nro. Documento',
    type: 'text',
    placeholder: 'DNI / CUIL…',
  },
  {
    key: 'estado',
    label: 'Estado',
    type: 'select',
    options: [
      { value: '', label: 'Todos' },
      { value: 'Activo',    label: 'Activo' },
      { value: 'Inactivo',  label: 'Inactivo' },
      { value: 'Observado', label: 'Observado' },
      { value: 'Cerrado',   label: 'Cerrado' },
    ],
  },
  {
    key: 'sectorial',
    label: 'Sectorial',
    type: 'select',
    options: [
      { value: '', label: 'Todas' },
      { value: 'Recursos Humanos', label: 'Recursos Humanos' },
      { value: 'Contabilidad',     label: 'Contabilidad' },
      { value: 'Sistemas',         label: 'Sistemas' },
      { value: 'Legales',          label: 'Legales' },
      { value: 'Dirección',        label: 'Dirección' },
    ],
  },
  {
    key: 'fechaIngreso',
    label: 'Fecha Ingreso',
    type: 'daterange',
    span: 2,
  },
]

// ─── Definición de columnas para Legajos ───────────────────────────────────

export const LEGAJO_COLUMNS: ColumnDef<Legajo>[] = [
  {
    key: 'nroLegajo',
    label: 'Nro. Legajo',
    width: 'w-32',
  },
  {
    key: 'titular',
    label: 'Titular',
    width: 'flex-1',
  },
  {
    key: 'nroDocumento',
    label: 'Documento',
    width: 'w-40',
    render: (row) => `${row.tipoDocumento}: ${row.nroDocumento}`,
  },
  {
    key: 'sectorial',
    label: 'Sectorial',
    width: 'w-44',
  },
  {
    key: 'estado',
    label: 'Estado',
    width: 'w-28',
  },
  {
    key: 'fechaIngreso',
    label: 'Ingreso',
    width: 'w-28',
    render: (row) => format(new Date(row.fechaIngreso), 'dd/MM/yyyy'),
  },
]

// ─── Función de búsqueda ───────────────────────────────────────────────────

export function searchLegajos(filters: LegajoFilters): Legajo[] {
  return MOCK_LEGAJOS.filter((l) => {
    if (filters.nroLegajo && !l.nroLegajo.toLowerCase().includes(filters.nroLegajo.toLowerCase())) return false
    if (filters.titular && !l.titular.toLowerCase().includes(filters.titular.toLowerCase())) return false
    if (filters.nroDocumento && !l.nroDocumento.replace(/\D/g, '').includes(filters.nroDocumento.replace(/\D/g, ''))) return false
    if (filters.estado && l.estado !== filters.estado) return false
    if (filters.sectorial && l.sectorial !== filters.sectorial) return false
    if (filters.fechaDesde && l.fechaIngreso < filters.fechaDesde) return false
    if (filters.fechaHasta && l.fechaIngreso > filters.fechaHasta) return false
    return true
  })
}
