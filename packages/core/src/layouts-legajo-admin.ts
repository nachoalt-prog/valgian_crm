import { eq, count } from "drizzle-orm";
import { db, layoutsLegajo, layoutsLegajoSolapas, bandejas, herramientas } from "@valgian/db";

/** ABM de LAYOUTS_LEGAJO — a diferencia de packages/core/src/layouts-legajo.ts (resolución para el modal de legajo). */

export async function listLayoutsLegajoAdmin() {
  return db.select().from(layoutsLegajo).orderBy(layoutsLegajo.nombre);
}

export interface LayoutLegajoInput {
  codigo: string;
  nombre: string;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createLayoutLegajo(data: LayoutLegajoInput): Promise<Resultado<typeof layoutsLegajo.$inferSelect>> {
  try {
    const [fila] = await db.insert(layoutsLegajo).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un layout con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateLayoutLegajo(id: string, data: LayoutLegajoInput): Promise<Resultado<typeof layoutsLegajo.$inferSelect>> {
  try {
    const [fila] = await db.update(layoutsLegajo).set(data).where(eq(layoutsLegajo.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un layout con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteLayoutLegajo(id: string): Promise<Resultado<true>> {
  const [{ value: solapasCount }] = await db.select({ value: count() }).from(layoutsLegajoSolapas).where(eq(layoutsLegajoSolapas.idLayout, id));
  const [{ value: bandejasCount }] = await db.select({ value: count() }).from(bandejas).where(eq(bandejas.idLayout, id));

  if (Number(solapasCount) > 0 || Number(bandejasCount) > 0) {
    const partes: string[] = [];
    if (Number(solapasCount) > 0) partes.push(`${solapasCount} solapa${Number(solapasCount) !== 1 ? "s" : ""}`);
    if (Number(bandejasCount) > 0) partes.push(`${bandejasCount} bandeja${Number(bandejasCount) !== 1 ? "s" : ""} usándolo`);
    return { error: `No se puede eliminar: tiene ${partes.join(" y ")}. Quitalos primero.` };
  }

  await db.delete(layoutsLegajo).where(eq(layoutsLegajo.id, id));
  return { data: true };
}

export interface SolapaConNombre {
  id: string;
  orden: number | null;
  nombre: string;
  idHerramienta: string | null;
  herramientaCodigo: string | null;
  herramientaNombre: string | null;
  visible: boolean | null;
  // Config libre de esta instancia puntual de la herramienta embebida — ver
  // domain/infraestructura.md, "Parámetros por punto de acceso".
  parametros: Record<string, unknown> | null;
}

export async function listLayoutSolapas(idLayout: string): Promise<SolapaConNombre[]> {
  return db
    .select({
      id: layoutsLegajoSolapas.id,
      orden: layoutsLegajoSolapas.orden,
      nombre: layoutsLegajoSolapas.nombre,
      idHerramienta: layoutsLegajoSolapas.idHerramienta,
      herramientaCodigo: herramientas.codigo,
      herramientaNombre: herramientas.nombre,
      visible: layoutsLegajoSolapas.visible,
      parametros: layoutsLegajoSolapas.parametros,
    })
    .from(layoutsLegajoSolapas)
    .leftJoin(herramientas, eq(herramientas.id, layoutsLegajoSolapas.idHerramienta))
    .where(eq(layoutsLegajoSolapas.idLayout, idLayout))
    .orderBy(layoutsLegajoSolapas.orden);
}

export interface SolapaInput {
  idLayout: string;
  orden: number;
  nombre: string;
  idHerramienta: string | null;
  visible: boolean;
  parametros: Record<string, unknown> | null;
}

export async function createLayoutSolapa(data: SolapaInput): Promise<Resultado<typeof layoutsLegajoSolapas.$inferSelect>> {
  try {
    const [fila] = await db.insert(layoutsLegajoSolapas).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una solapa en el orden ${data.orden} para este layout.` };
    throw err;
  }
}

export async function updateLayoutSolapa(id: string, data: SolapaInput): Promise<Resultado<typeof layoutsLegajoSolapas.$inferSelect>> {
  try {
    const [fila] = await db.update(layoutsLegajoSolapas).set(data).where(eq(layoutsLegajoSolapas.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una solapa en el orden ${data.orden} para este layout.` };
    throw err;
  }
}

export async function deleteLayoutSolapa(id: string): Promise<Resultado<true>> {
  await db.delete(layoutsLegajoSolapas).where(eq(layoutsLegajoSolapas.id, id));
  return { data: true };
}
