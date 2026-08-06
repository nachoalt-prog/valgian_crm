import { eq, and, count } from "drizzle-orm";
import { db } from "@valgian/db";
import {
  xccTiposMovimientos,
  xccMovimientos,
  xccSaldos,
  xccTiposRetencion,
  xccCondicionesImpositivas,
  xccClientesCondicionHistorico,
  xccClientes,
  xccCondicionesRetencion,
} from "./schema";

/**
 * ABMs de los 3 catálogos configurables del módulo — mismo esqueleto que
 * packages/core/src/monedas.ts. XCC_TIPOS_MOVIMIENTOS tiene reglas propias
 * (ver docs/domain/cuenta-corriente.md): 6 CODIGO están hardcodeados en el
 * motor SQL (RAISE EXCEPTION si faltan), y SIGNO/AFECTA_CAPITAL/ORDEN se leen
 * en runtime — las otras dos tablas no tienen esa restricción, son 100%
 * datos libres a propósito.
 */

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") return true;
  if (typeof err === "object" && err !== null && "cause" in err) return esViolacionUnica((err as { cause: unknown }).cause);
  return false;
}

// ---------- XCC_TIPOS_MOVIMIENTOS ----------

export async function listTiposMovimientoAdmin() {
  return db.select().from(xccTiposMovimientos).orderBy(xccTiposMovimientos.orden);
}

export interface TipoMovimientoCreateInput {
  codigo: string;
  nombre: string;
  signo: number;
  afectaCapital: boolean;
  orden: number;
}

export interface TipoMovimientoUpdateInput {
  nombre: string;
  signo: number;
  afectaCapital: boolean;
  orden: number;
}

export async function createTipoMovimiento(data: TipoMovimientoCreateInput): Promise<Resultado<typeof xccTiposMovimientos.$inferSelect>> {
  try {
    const [fila] = await db
      .insert(xccTiposMovimientos)
      .values({
        ...data,
        // Un tipo nuevo siempre es manual — los 6 que genera el motor solo
        // (apertura/devengamiento/acreditacion_intereses/cierre/checkpoint/
        // retencion) ya están sembrados y el motor los busca por CODIGO fijo,
        // no tiene sentido crear otro. AFECTA_INTERES/ES_DEVENGAMIENTO/
        // ES_ACREDITACION_INTERES no los lee ningún .sql del motor — quedan
        // en false, no se exponen en el formulario.
        generadoPorMotor: false,
        afectaInteres: false,
        esDevengamiento: false,
        esAcreditacionInteres: false,
      })
      .returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un tipo de movimiento con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateTipoMovimiento(id: string, data: TipoMovimientoUpdateInput): Promise<Resultado<typeof xccTiposMovimientos.$inferSelect>> {
  const [existente] = await db.select().from(xccTiposMovimientos).where(eq(xccTiposMovimientos.id, id));
  if (!existente) return { error: "No existe ese tipo de movimiento." };
  if (existente.generadoPorMotor) {
    return { error: "Este tipo lo genera el motor de cálculo — no se puede editar." };
  }

  // CODIGO no viaja en `data` — no se puede cambiar después de creado, ni
  // siquiera en un tipo manual (mismo criterio para toda la tabla, para no
  // tener una regla distinta según la fila).
  const [fila] = await db.update(xccTiposMovimientos).set(data).where(eq(xccTiposMovimientos.id, id)).returning();
  return { data: fila };
}

export async function deleteTipoMovimiento(id: string): Promise<Resultado<true>> {
  const [existente] = await db.select().from(xccTiposMovimientos).where(eq(xccTiposMovimientos.id, id));
  if (!existente) return { error: "No existe ese tipo de movimiento." };
  if (existente.generadoPorMotor) {
    return { error: "Este tipo lo genera el motor de cálculo — no se puede borrar." };
  }

  const [{ value: movimientosCount }] = await db.select({ value: count() }).from(xccMovimientos).where(eq(xccMovimientos.idTipoMovimiento, id));
  const [{ value: saldosCount }] = await db.select({ value: count() }).from(xccSaldos).where(eq(xccSaldos.idTipoMovimiento, id));
  const total = Number(movimientosCount) + Number(saldosCount);
  if (total > 0) {
    return { error: `No se puede eliminar: hay ${total} movimiento${total !== 1 ? "s" : ""}/asiento${total !== 1 ? "s" : ""} que usan este tipo.` };
  }

  await db.delete(xccTiposMovimientos).where(eq(xccTiposMovimientos.id, id));
  return { data: true };
}

// ---------- XCC_TIPOS_RETENCION ----------

export async function listTiposRetencionAdmin() {
  return db.select().from(xccTiposRetencion).orderBy(xccTiposRetencion.orden);
}

export interface TipoRetencionInput {
  codigo: string;
  nombre: string;
  orden: number;
  activa: boolean;
  alicuota: number;
  usaCondicionImpositiva: boolean;
}

export async function createTipoRetencion(data: TipoRetencionInput): Promise<Resultado<typeof xccTiposRetencion.$inferSelect>> {
  try {
    const [fila] = await db.insert(xccTiposRetencion).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un tipo de retención con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateTipoRetencion(id: string, data: TipoRetencionInput): Promise<Resultado<typeof xccTiposRetencion.$inferSelect>> {
  try {
    const [fila] = await db.update(xccTiposRetencion).set(data).where(eq(xccTiposRetencion.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un tipo de retención con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteTipoRetencion(id: string): Promise<Resultado<true>> {
  const [{ value: saldosCount }] = await db.select({ value: count() }).from(xccSaldos).where(eq(xccSaldos.idTipoRetencion, id));
  const [{ value: overridesCount }] = await db.select({ value: count() }).from(xccCondicionesRetencion).where(eq(xccCondicionesRetencion.idTipoRetencion, id));
  const total = Number(saldosCount) + Number(overridesCount);
  if (total > 0) {
    const partes: string[] = [];
    if (Number(saldosCount) > 0) partes.push(`${saldosCount} asiento${Number(saldosCount) !== 1 ? "s" : ""} de retención`);
    if (Number(overridesCount) > 0) partes.push(`${overridesCount} alícuota${Number(overridesCount) !== 1 ? "s" : ""} por condición impositiva`);
    return { error: `No se puede eliminar: hay ${partes.join(" y ")} que usan este tipo.` };
  }

  await db.delete(xccTiposRetencion).where(eq(xccTiposRetencion.id, id));
  return { data: true };
}

// ---------- XCC_CONDICIONES_RETENCION (alícuotas por condición, N:M) ----------

export interface AlicuotaPorCondicionFila {
  idTipoRetencion: string;
  tipoRetencionNombre: string;
  alicuotaDefault: number | null;
  alicuotaOverride: number | null;
}

/** Tipos de retención "por condición impositiva" con su default y el override de `idCondicion`, si lo tiene. */
export async function listAlicuotasPorCondicion(idCondicion: string): Promise<AlicuotaPorCondicionFila[]> {
  const filas = await db
    .select({
      idTipoRetencion: xccTiposRetencion.id,
      tipoRetencionNombre: xccTiposRetencion.nombre,
      alicuotaDefault: xccTiposRetencion.alicuota,
      alicuotaOverride: xccCondicionesRetencion.alicuota,
    })
    .from(xccTiposRetencion)
    .leftJoin(
      xccCondicionesRetencion,
      and(eq(xccCondicionesRetencion.idTipoRetencion, xccTiposRetencion.id), eq(xccCondicionesRetencion.idCondicionImpositiva, idCondicion)),
    )
    .where(eq(xccTiposRetencion.usaCondicionImpositiva, true))
    .orderBy(xccTiposRetencion.orden);
  return filas;
}

/** `alicuota: null` borra el override (vuelve a heredar el default de la retención); si no, upsert. */
export async function setAlicuotaCondicionRetencion(idCondicion: string, idTipoRetencion: string, alicuota: number | null): Promise<Resultado<true>> {
  if (alicuota === null) {
    await db
      .delete(xccCondicionesRetencion)
      .where(and(eq(xccCondicionesRetencion.idCondicionImpositiva, idCondicion), eq(xccCondicionesRetencion.idTipoRetencion, idTipoRetencion)));
    return { data: true };
  }

  await db
    .insert(xccCondicionesRetencion)
    .values({ idCondicionImpositiva: idCondicion, idTipoRetencion, alicuota })
    .onConflictDoUpdate({
      target: [xccCondicionesRetencion.idCondicionImpositiva, xccCondicionesRetencion.idTipoRetencion],
      set: { alicuota },
    });
  return { data: true };
}

// ---------- XCC_CONDICIONES_IMPOSITIVAS ----------

export async function listCondicionesImpositivasAdmin() {
  return db.select().from(xccCondicionesImpositivas).orderBy(xccCondicionesImpositivas.nombre);
}

export interface CondicionImpositivaInput {
  codigo: string;
  nombre: string;
}

export async function createCondicionImpositiva(data: CondicionImpositivaInput): Promise<Resultado<typeof xccCondicionesImpositivas.$inferSelect>> {
  try {
    const [fila] = await db.insert(xccCondicionesImpositivas).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una condición impositiva con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateCondicionImpositiva(
  id: string,
  data: CondicionImpositivaInput,
): Promise<Resultado<typeof xccCondicionesImpositivas.$inferSelect>> {
  try {
    const [fila] = await db.update(xccCondicionesImpositivas).set(data).where(eq(xccCondicionesImpositivas.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una condición impositiva con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteCondicionImpositiva(id: string): Promise<Resultado<true>> {
  const [{ value: historicoCount }] = await db
    .select({ value: count() })
    .from(xccClientesCondicionHistorico)
    .where(eq(xccClientesCondicionHistorico.idCondicionImpositiva, id));
  const [{ value: clientesCount }] = await db.select({ value: count() }).from(xccClientes).where(eq(xccClientes.idCondicionImpositiva, id));
  const total = Number(historicoCount) + Number(clientesCount);
  if (total > 0) {
    return { error: `No se puede eliminar: hay ${total} cliente${total !== 1 ? "s" : ""} con esta condición impositiva asignada.` };
  }

  // Los overrides de XCC_CONDICIONES_RETENCION no son un uso bloqueante — son
  // config propia de la condición que se va, se borran con ella.
  await db.delete(xccCondicionesRetencion).where(eq(xccCondicionesRetencion.idCondicionImpositiva, id));
  await db.delete(xccCondicionesImpositivas).where(eq(xccCondicionesImpositivas.id, id));
  return { data: true };
}
