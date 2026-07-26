import { eq, count } from "drizzle-orm";
import { db, filtros, bandejasFiltros } from "@valgian/db";

export async function listFiltros() {
  return db.select().from(filtros).orderBy(filtros.nombre);
}

export interface FiltroInput {
  codigo: string;
  nombre: string;
  tipo: string;
  query: string | null;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createFiltro(data: FiltroInput): Promise<Resultado<typeof filtros.$inferSelect>> {
  try {
    const [fila] = await db.insert(filtros).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un filtro con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateFiltro(id: string, data: FiltroInput): Promise<Resultado<typeof filtros.$inferSelect>> {
  try {
    const [fila] = await db.update(filtros).set(data).where(eq(filtros.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un filtro con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteFiltro(id: string): Promise<Resultado<true>> {
  const [{ value: usosCount }] = await db.select({ value: count() }).from(bandejasFiltros).where(eq(bandejasFiltros.idFiltro, id));

  if (Number(usosCount) > 0) {
    return { error: `No se puede eliminar: está usado en ${usosCount} bandeja${Number(usosCount) !== 1 ? "s" : ""}.` };
  }

  await db.delete(filtros).where(eq(filtros.id, id));
  return { data: true };
}
