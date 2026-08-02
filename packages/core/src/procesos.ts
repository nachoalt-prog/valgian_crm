import { eq, count } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, procesos, procesosEjecuciones } from "@valgian/db";

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

export async function listProcesosAdmin() {
  return db.select().from(procesos).orderBy(procesos.nombre);
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
