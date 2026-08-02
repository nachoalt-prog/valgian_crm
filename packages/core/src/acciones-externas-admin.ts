import { eq, count } from "drizzle-orm";
import { db, accionesExternas, accionesExternasCola, mensajeriaCola } from "@valgian/db";

/**
 * ABM de ACCIONES_EXTERNAS — ver domain/acciones-externas.md. Distinto de
 * acciones-externas.ts (el motor: barrido, NOTIFY, finalizarIntentoAccionExterna).
 */

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function listAccionesExternasAdmin() {
  return db.select().from(accionesExternas).orderBy(accionesExternas.nombre);
}

export interface AccionExternaInput {
  codigo: string;
  nombre: string;
  componente: string;
  parametros: unknown;
  activo: boolean;
  inmediato: boolean;
  reintentosMax: number | null;
  reintentosMargen: number | null;
}

export async function createAccionExterna(data: AccionExternaInput): Promise<Resultado<typeof accionesExternas.$inferSelect>> {
  try {
    const [fila] = await db.insert(accionesExternas).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una acción externa con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateAccionExterna(id: string, data: AccionExternaInput): Promise<Resultado<typeof accionesExternas.$inferSelect>> {
  try {
    const [fila] = await db.update(accionesExternas).set(data).where(eq(accionesExternas.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una acción externa con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteAccionExterna(id: string): Promise<Resultado<true>> {
  const [{ value: colaCount }] = await db.select({ value: count() }).from(accionesExternasCola).where(eq(accionesExternasCola.idAccionExterna, id));
  if (Number(colaCount) > 0) {
    return { error: `No se puede eliminar: hay ${colaCount} disparo${Number(colaCount) !== 1 ? "s" : ""} registrado${Number(colaCount) !== 1 ? "s" : ""} en ACCIONES_EXTERNAS_COLA para esta acción.` };
  }

  const [{ value: mensajeriaCount }] = await db.select({ value: count() }).from(mensajeriaCola).where(eq(mensajeriaCola.idAccionExterna, id));
  if (Number(mensajeriaCount) > 0) {
    return { error: `No se puede eliminar: hay ${mensajeriaCount} mensaje${Number(mensajeriaCount) !== 1 ? "s" : ""} de mensajería asociado${Number(mensajeriaCount) !== 1 ? "s" : ""} a esta acción.` };
  }

  await db.delete(accionesExternas).where(eq(accionesExternas.id, id));
  return { data: true };
}
