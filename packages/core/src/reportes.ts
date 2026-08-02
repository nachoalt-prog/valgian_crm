import { eq, sql } from "drizzle-orm";
import { db, reportes, reportesCategorias, reportesFiltros, reportesPerfiles, filtros } from "@valgian/db";
import { ejecutarQueryConFiltros, type FiltroAplicable } from "./query-filtros";

/**
 * Capa de ejecución de Reportes — ver ADR 0014 y domain/reportes.md.
 * Mismo mecanismo que Bandejas (packages/core/src/bandejas.ts), pero sin
 * acción de apertura, y siempre paginado (el volumen esperado de un reporte
 * de análisis es mayor al de una bandeja de trabajo).
 */

const PAGE_SIZE = 50;

export interface ReporteResumen {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoriaNombre: string | null;
}

export async function listReportesParaPerfil(perfilId: string): Promise<ReporteResumen[]> {
  return db
    .select({
      id: reportes.id,
      codigo: reportes.codigo,
      nombre: reportes.nombre,
      descripcion: reportes.descripcion,
      categoriaNombre: reportesCategorias.nombre,
    })
    .from(reportesPerfiles)
    .innerJoin(reportes, eq(reportes.id, reportesPerfiles.idReporte))
    .leftJoin(reportesCategorias, eq(reportesCategorias.id, reportes.idCategoria))
    .where(eq(reportesPerfiles.idPerfil, perfilId))
    .orderBy(reportesCategorias.nombre, reportes.nombre);
}

export interface ColumnaReporte {
  campo: string;
  label: string;
  tipo?: string;
  // Solo aplica con tipo:"badge" — mapea el valor crudo de la columna a un tono
  // semántico ("success"/"warning"/"error"/"info"/"neutral", ver resultados-formato.tsx).
  // Opcional: sin esto, el badge se ve igual que siempre (outline sin color).
  colores?: Record<string, string>;
}

export interface OpcionFiltroReporte {
  value: string;
  label: string;
}

export interface FiltroReporte {
  campo: string;
  nombre: string;
  tipo: string;
  orden: number;
  opciones?: OpcionFiltroReporte[];
}

export interface ReporteConfig {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  columnas: ColumnaReporte[];
  filtros: FiltroReporte[];
}

export async function getReporteConfig(reporteId: string): Promise<ReporteConfig> {
  const [reporte] = await db.select().from(reportes).where(eq(reportes.id, reporteId));
  if (!reporte) throw new Error(`No existe el reporte "${reporteId}".`);

  const filtrosRows = await db
    .select({
      campo: reportesFiltros.campo,
      orden: reportesFiltros.orden,
      nombre: filtros.nombre,
      tipo: filtros.tipo,
      query: filtros.query,
    })
    .from(reportesFiltros)
    .innerJoin(filtros, eq(filtros.id, reportesFiltros.idFiltro))
    .where(eq(reportesFiltros.idReporte, reporteId))
    .orderBy(reportesFiltros.orden);

  const filtrosConOpciones: FiltroReporte[] = await Promise.all(
    filtrosRows.map(async (f) => {
      let opciones: OpcionFiltroReporte[] | undefined;
      if (f.tipo === "select" && f.query) {
        const filas = await db.execute<{ value: string; label: string }>(sql.raw(f.query));
        opciones = filas.map((r) => ({ value: String(r.value), label: String(r.label) }));
      }
      return {
        campo: f.campo ?? "",
        nombre: f.nombre,
        tipo: f.tipo ?? "texto_like",
        orden: f.orden ?? 0,
        opciones,
      };
    }),
  );

  return {
    id: reporte.id,
    codigo: reporte.codigo,
    nombre: reporte.nombre,
    descripcion: reporte.descripcion,
    columnas: (reporte.columnas as ColumnaReporte[] | null) ?? [],
    filtros: filtrosConOpciones,
  };
}

async function getFiltrosAplicables(reporteId: string): Promise<FiltroAplicable[]> {
  return db
    .select({ campo: reportesFiltros.campo, tipo: filtros.tipo })
    .from(reportesFiltros)
    .innerJoin(filtros, eq(filtros.id, reportesFiltros.idFiltro))
    .where(eq(reportesFiltros.idReporte, reporteId));
}

export interface BuscarReporteResultado {
  rows: Record<string, unknown>[];
  hayMas: boolean;
}

/** `pagina` es 0-based. Trae PAGE_SIZE+1 filas para saber si hay una página siguiente sin un COUNT(*) aparte. */
export async function buscarReporte(reporteId: string, valores: Record<string, string>, pagina: number): Promise<BuscarReporteResultado> {
  const [reporte] = await db.select().from(reportes).where(eq(reportes.id, reporteId));
  if (!reporte?.query) throw new Error(`El reporte "${reporteId}" no tiene QUERY configurado.`);

  const filtrosRows = await getFiltrosAplicables(reporteId);
  const filas = await ejecutarQueryConFiltros(reporte.query, filtrosRows, valores, {
    limit: PAGE_SIZE + 1,
    offset: pagina * PAGE_SIZE,
  });
  const hayMas = filas.length > PAGE_SIZE;
  return { rows: hayMas ? filas.slice(0, PAGE_SIZE) : filas, hayMas };
}

function escaparCampo(valor: unknown, separador: string): string {
  if (valor === null || valor === undefined) return "";
  const texto = valor instanceof Date ? valor.toISOString() : String(valor);
  if (texto.includes(separador) || texto.includes('"') || texto.includes("\n") || texto.includes("\r")) {
    return `"${texto.replaceAll('"', '""')}"`;
  }
  return texto;
}

/**
 * Export completo (sin límite/offset — trae TODO el resultado filtrado, no
 * solo la página visible, ver ADR 0014). Arma el archivo con el orden y los
 * `label` de REPORTES.COLUMNAS como cabecera.
 */
export async function exportarReporte(reporteId: string, valores: Record<string, string>, formato: "csv" | "tsv"): Promise<string> {
  const [reporte] = await db.select().from(reportes).where(eq(reportes.id, reporteId));
  if (!reporte?.query) throw new Error(`El reporte "${reporteId}" no tiene QUERY configurado.`);

  const filtrosRows = await getFiltrosAplicables(reporteId);
  const columnas = (reporte.columnas as ColumnaReporte[] | null) ?? [];
  const filas = await ejecutarQueryConFiltros(reporte.query, filtrosRows, valores);

  const separador = formato === "csv" ? "," : "\t";
  const lineas = [
    columnas.map((c) => escaparCampo(c.label, separador)).join(separador),
    ...filas.map((fila) => columnas.map((c) => escaparCampo(fila[c.campo], separador)).join(separador)),
  ];
  return lineas.join("\r\n");
}
