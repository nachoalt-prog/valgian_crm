import { and, eq, count } from "drizzle-orm";
import { db, reportes, reportesFiltros, reportesPerfiles, filtros, perfiles } from "@valgian/db";

/** ABM de REPORTES — a diferencia de packages/core/src/reportes.ts (ejecución de búsquedas/export). */

export async function listReportesAdmin() {
  return db.select().from(reportes).orderBy(reportes.nombre);
}

export interface ReporteInput {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  query: string;
  columnas: unknown;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createReporte(data: ReporteInput): Promise<Resultado<typeof reportes.$inferSelect>> {
  try {
    const [fila] = await db.insert(reportes).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un reporte con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateReporte(id: string, data: ReporteInput): Promise<Resultado<typeof reportes.$inferSelect>> {
  try {
    const [fila] = await db.update(reportes).set(data).where(eq(reportes.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un reporte con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteReporte(id: string): Promise<Resultado<true>> {
  const [{ value: filtrosCount }] = await db.select({ value: count() }).from(reportesFiltros).where(eq(reportesFiltros.idReporte, id));
  const [{ value: perfilesCount }] = await db.select({ value: count() }).from(reportesPerfiles).where(eq(reportesPerfiles.idReporte, id));

  if (Number(filtrosCount) > 0 || Number(perfilesCount) > 0) {
    const partes: string[] = [];
    if (Number(filtrosCount) > 0) partes.push(`${filtrosCount} filtro${Number(filtrosCount) !== 1 ? "s" : ""}`);
    if (Number(perfilesCount) > 0) partes.push(`${perfilesCount} perfil${Number(perfilesCount) !== 1 ? "es" : ""}`);
    return { error: `No se puede eliminar: tiene ${partes.join(" y ")} vinculados. Quitalos primero.` };
  }

  await db.delete(reportes).where(eq(reportes.id, id));
  return { data: true };
}

export interface ReporteFiltroConNombre {
  id: string;
  idFiltro: string | null;
  campo: string | null;
  orden: number | null;
  filtroCodigo: string | null;
  filtroNombre: string | null;
  filtroTipo: string | null;
}

export async function listReporteFiltros(reporteId: string): Promise<ReporteFiltroConNombre[]> {
  return db
    .select({
      id: reportesFiltros.id,
      idFiltro: reportesFiltros.idFiltro,
      campo: reportesFiltros.campo,
      orden: reportesFiltros.orden,
      filtroCodigo: filtros.codigo,
      filtroNombre: filtros.nombre,
      filtroTipo: filtros.tipo,
    })
    .from(reportesFiltros)
    .leftJoin(filtros, eq(filtros.id, reportesFiltros.idFiltro))
    .where(eq(reportesFiltros.idReporte, reporteId))
    .orderBy(reportesFiltros.orden);
}

export interface ReporteFiltroInput {
  idReporte: string;
  idFiltro: string;
  campo: string;
  orden: number;
}

export async function createReporteFiltro(data: ReporteFiltroInput): Promise<Resultado<typeof reportesFiltros.$inferSelect>> {
  const [fila] = await db.insert(reportesFiltros).values(data).returning();
  return { data: fila };
}

export async function updateReporteFiltro(
  id: string,
  data: { idFiltro: string; campo: string; orden: number },
): Promise<Resultado<typeof reportesFiltros.$inferSelect>> {
  const [fila] = await db.update(reportesFiltros).set(data).where(eq(reportesFiltros.id, id)).returning();
  return { data: fila };
}

export async function deleteReporteFiltro(id: string): Promise<Resultado<true>> {
  await db.delete(reportesFiltros).where(eq(reportesFiltros.id, id));
  return { data: true };
}

export interface PerfilConEstadoReporte {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

/** Todos los PERFILES existentes, marcando cuáles están vinculados a este reporte vía REPORTES_PERFILES. */
export async function getPerfilesConEstadoReporte(reporteId: string): Promise<PerfilConEstadoReporte[]> {
  const todos = await db.select({ id: perfiles.id, codigo: perfiles.codigo, nombre: perfiles.nombre }).from(perfiles);
  const vinculados = await db
    .select({ idPerfil: reportesPerfiles.idPerfil })
    .from(reportesPerfiles)
    .where(eq(reportesPerfiles.idReporte, reporteId));

  const activos = new Set(vinculados.map((v) => v.idPerfil));
  return todos.map((p) => ({ ...p, activo: activos.has(p.id) }));
}

export async function toggleReportePerfil(reporteId: string, perfilId: string, activo: boolean): Promise<Resultado<true>> {
  if (activo) {
    try {
      await db.insert(reportesPerfiles).values({ idReporte: reporteId, idPerfil: perfilId });
    } catch (err) {
      if (!esViolacionUnica(err)) throw err;
    }
  } else {
    await db.delete(reportesPerfiles).where(and(eq(reportesPerfiles.idReporte, reporteId), eq(reportesPerfiles.idPerfil, perfilId)));
  }
  return { data: true };
}
