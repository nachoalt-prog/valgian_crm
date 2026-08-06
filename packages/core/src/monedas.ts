import { eq, count, isNotNull } from "drizzle-orm";
import { db, monedas, cotizaciones } from "@valgian/db";

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") return true;
  if (typeof err === "object" && err !== null && "cause" in err) return esViolacionUnica((err as { cause: unknown }).cause);
  return false;
}

/** ABM de MONEDAS — a diferencia de listMonedasConCodigoApi (usada por el handler de consulta). */
export async function listMonedasAdmin() {
  return db.select().from(monedas).orderBy(monedas.nombre);
}

export interface MonedaInput {
  codigo: string;
  nombre: string;
  codigoApi: string | null;
}

export async function createMoneda(data: MonedaInput): Promise<Resultado<typeof monedas.$inferSelect>> {
  try {
    const [fila] = await db.insert(monedas).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una moneda con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateMoneda(id: string, data: MonedaInput): Promise<Resultado<typeof monedas.$inferSelect>> {
  try {
    const [fila] = await db.update(monedas).set(data).where(eq(monedas.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una moneda con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteMoneda(id: string): Promise<Resultado<true>> {
  const [{ value: cotizacionesCount }] = await db.select({ value: count() }).from(cotizaciones).where(eq(cotizaciones.idMoneda, id));

  if (Number(cotizacionesCount) > 0) {
    return { error: `No se puede eliminar: hay ${cotizacionesCount} cotización${Number(cotizacionesCount) !== 1 ? "es" : ""} registrada${Number(cotizacionesCount) !== 1 ? "s" : ""} para esta moneda.` };
  }

  await db.delete(monedas).where(eq(monedas.id, id));
  return { data: true };
}

export interface MonedaConCodigoApi {
  id: string;
  codigo: string;
  nombre: string;
  codigoApi: string;
}

/** Solo las MONEDAS que se consultan contra una API externa (CODIGO_API no nulo) — ver domain/acciones-externas.md. */
export async function listMonedasConCodigoApi(): Promise<MonedaConCodigoApi[]> {
  const filas = await db.select().from(monedas).where(isNotNull(monedas.codigoApi));
  return filas.map((f) => ({ ...f, codigoApi: f.codigoApi as string }));
}

export interface CrearCotizacionInput {
  idMoneda: string;
  compra: number;
  venta: number;
  idAccionExternaCola?: string | null;
}

export async function crearCotizacion(input: CrearCotizacionInput): Promise<void> {
  await db.insert(cotizaciones).values({
    idMoneda: input.idMoneda,
    compra: input.compra,
    venta: input.venta,
    fechaConsulta: new Date(),
    idAccionExternaCola: input.idAccionExternaCola ?? null,
  });
}
