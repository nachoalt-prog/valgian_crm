import { eq, and, count, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, procesos, procesosPasos, procesosEjecuciones } from "@valgian/db";

/** ESTADO='pendiente'/'procesando' — la misma ejecución todavía puede correr o está corriendo ahora. */
const ESTADOS_ACTIVOS = ["pendiente", "procesando"] as const;

/**
 * ABM de PROCESOS — ver domain/procesos.md, ADR 0015. El ABM administra
 * CODIGO/NOMBRE/DESCRIPCION/ACTIVO/CRON/REINTENTO_MINUTOS/REINTENTOS_MAX
 * (config operativa) — NUNCA PROCESOS_PASOS (dev-only, mismo criterio que
 * ACCIONES.COMANDO, ADR 0009).
 */

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export interface ProcesoConEstado {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  cron: string;
  activo: boolean | null;
  reintentoMinutos: number | null;
  reintentosMax: number | null;
  /** true si hay una PROCESOS_EJECUCIONES 'pendiente' o 'procesando' para este proceso — ver ProcesosTool (spinner). */
  ejecutandose: boolean;
}

export async function listProcesosAdmin(): Promise<ProcesoConEstado[]> {
  const filas = await db.select().from(procesos).orderBy(procesos.nombre);

  const activas = await db
    .selectDistinct({ idProceso: procesosEjecuciones.idProceso })
    .from(procesosEjecuciones)
    .where(inArray(procesosEjecuciones.estado, ESTADOS_ACTIVOS));
  const idsActivos = new Set(activas.map((a) => a.idProceso));

  return filas.map((p) => ({ ...p, ejecutandose: idsActivos.has(p.id) }));
}

/** Solo lectura — el ABM de PROCESOS no edita PROCESOS_PASOS (dev-only, ver comentario de arriba). */
export async function listPasosPorProceso(idProceso: string) {
  return db
    .select({ id: procesosPasos.id, orden: procesosPasos.orden, nombre: procesosPasos.nombre, timeoutMinutos: procesosPasos.timeoutMinutos })
    .from(procesosPasos)
    .where(eq(procesosPasos.idProceso, idProceso))
    .orderBy(procesosPasos.orden);
}

export interface ProcesoInput {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  cron: string;
  activo: boolean;
  reintentoMinutos: number | null;
  reintentosMax: number | null;
}

export async function createProceso(data: ProcesoInput): Promise<Resultado<typeof procesos.$inferSelect>> {
  try {
    const [fila] = await db.insert(procesos).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un proceso con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateProceso(id: string, data: ProcesoInput): Promise<Resultado<typeof procesos.$inferSelect>> {
  try {
    const [fila] = await db.update(procesos).set(data).where(eq(procesos.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un proceso con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteProceso(id: string): Promise<Resultado<true>> {
  const [{ value: ejecucionesCount }] = await db.select({ value: count() }).from(procesosEjecuciones).where(eq(procesosEjecuciones.idProceso, id));
  if (Number(ejecucionesCount) > 0) {
    return { error: `No se puede eliminar: hay ${ejecucionesCount} ejecución${Number(ejecucionesCount) !== 1 ? "es" : ""} registrada${Number(ejecucionesCount) !== 1 ? "s" : ""} para este proceso.` };
  }

  await db.delete(procesos).where(eq(procesos.id, id));
  return { data: true };
}

/**
 * Cancelación cooperativa (ver packages/db/sql/0013_sp_ejecutar_un_proceso_pendiente.sql):
 * si la ejecución está 'pendiente', el ejecutor directamente nunca la reclama.
 * Si ya está 'procesando', el ejecutor relee el ESTADO ANTES de cada paso — el
 * paso que ya esté corriendo en este mismo instante termina igual (no hay
 * forma de interrumpir un EXECUTE en curso sin matar el backend de Postgres),
 * pero ninguno más arranca después.
 */
export async function cancelarEjecucionProceso(idProceso: string): Promise<Resultado<true>> {
  const filas = await db
    .update(procesosEjecuciones)
    .set({ estado: "cancelada", fechaFin: new Date() })
    .where(and(eq(procesosEjecuciones.idProceso, idProceso), inArray(procesosEjecuciones.estado, ESTADOS_ACTIVOS)))
    .returning();

  if (filas.length === 0) return { error: "No hay ninguna ejecución pendiente o en curso para cancelar." };
  return { data: true };
}

/**
 * "Correr ahora" — INSERT directo en PROCESOS_EJECUCIONES (ORIGEN='manual'),
 * sin pasar por el evaluador. Se suma a la misma cola que ya reclaman los
 * ejecutores — mismo guard de no-solapamiento, mismas reglas de reintento si falla.
 */
export async function dispararProcesoManual(idProceso: string, idUsuario: string): Promise<Resultado<true>> {
  try {
    await db.execute(
      sql`INSERT INTO "PROCESOS_EJECUCIONES" ("ID_PROCESO", "FECHA_PROGRAMADA", "ORIGEN", "ID_USUARIO_DISPARO", "ESTADO")
          VALUES (${idProceso}, now(), 'manual', ${idUsuario}, 'pendiente')`,
    );
    return { data: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error disparando el proceso.";
    return { error: message };
  }
}
