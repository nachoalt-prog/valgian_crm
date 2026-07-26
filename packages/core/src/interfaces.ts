import { and, count, eq } from "drizzle-orm";
import { db, interfaz, perfiles, interfacesMenues, menues } from "@valgian/db";

export async function listInterfaces() {
  return db.select().from(interfaz);
}

export interface InterfazInput {
  codigo: string;
  nombre: string;
  fuente: string | null;
  colorPrimario: string | null;
  colorSecundario: string | null;
  titulo: string | null;
  imagenFondo: string | null;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createInterfaz(data: InterfazInput): Promise<Resultado<typeof interfaz.$inferSelect>> {
  try {
    const [fila] = await db.insert(interfaz).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una interfaz con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateInterfaz(
  id: string,
  data: InterfazInput,
): Promise<Resultado<typeof interfaz.$inferSelect>> {
  try {
    const [fila] = await db.update(interfaz).set(data).where(eq(interfaz.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una interfaz con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteInterfaz(id: string): Promise<Resultado<true>> {
  const [{ value: perfilesCount }] = await db
    .select({ value: count() })
    .from(perfiles)
    .where(eq(perfiles.idInterfaz, id));
  const [{ value: menuesCount }] = await db
    .select({ value: count() })
    .from(interfacesMenues)
    .where(eq(interfacesMenues.idInterfaz, id));

  if (Number(perfilesCount) > 0 || Number(menuesCount) > 0) {
    const partes: string[] = [];
    if (Number(perfilesCount) > 0) partes.push(`${perfilesCount} perfil${Number(perfilesCount) !== 1 ? "es" : ""}`);
    if (Number(menuesCount) > 0) partes.push(`${menuesCount} menú${Number(menuesCount) !== 1 ? "es" : ""} vinculado${Number(menuesCount) !== 1 ? "s" : ""}`);
    return { error: `No se puede eliminar: tiene ${partes.join(" y ")}.` };
  }

  await db.delete(interfaz).where(eq(interfaz.id, id));
  return { data: true };
}

export interface MenuConEstado {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

/** Todos los MENUES existentes, marcando cuáles están vinculados a esta interfaz vía INTERFACES_MENUES. */
export async function getMenuesConEstado(interfazId: string): Promise<MenuConEstado[]> {
  const todos = await db.select({ id: menues.id, codigo: menues.codigo, nombre: menues.nombre }).from(menues);
  const vinculados = await db
    .select({ idMenu: interfacesMenues.idMenu })
    .from(interfacesMenues)
    .where(eq(interfacesMenues.idInterfaz, interfazId));

  const activos = new Set(vinculados.map((v) => v.idMenu));
  return todos.map((m) => ({ ...m, activo: activos.has(m.id) }));
}

export async function toggleInterfazMenu(interfazId: string, menuId: string, activo: boolean): Promise<Resultado<true>> {
  if (activo) {
    try {
      await db.insert(interfacesMenues).values({ idInterfaz: interfazId, idMenu: menuId });
    } catch (err) {
      if (!esViolacionUnica(err)) throw err;
    }
  } else {
    await db
      .delete(interfacesMenues)
      .where(and(eq(interfacesMenues.idInterfaz, interfazId), eq(interfacesMenues.idMenu, menuId)));
  }
  return { data: true };
}
