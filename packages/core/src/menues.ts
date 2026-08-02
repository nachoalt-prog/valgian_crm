import { count, eq } from "drizzle-orm";
import { db, menues, menuesOpciones, interfacesMenues, herramientas } from "@valgian/db";

export interface MenuConContador {
  id: string;
  codigo: string;
  nombre: string;
  orden: number | null;
  abierto: boolean | null;
  opcionesCount: number;
}

export async function listMenues(): Promise<MenuConContador[]> {
  const rows = await db
    .select({
      id: menues.id,
      codigo: menues.codigo,
      nombre: menues.nombre,
      orden: menues.orden,
      abierto: menues.abierto,
      opcionesCount: count(menuesOpciones.id),
    })
    .from(menues)
    .leftJoin(menuesOpciones, eq(menuesOpciones.idMenu, menues.id))
    .groupBy(menues.id, menues.codigo, menues.nombre, menues.orden, menues.abierto);

  return rows.map((r) => ({ ...r, opcionesCount: Number(r.opcionesCount) }));
}

export interface MenuInput {
  codigo: string;
  nombre: string;
  orden: number | null;
  abierto: boolean;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createMenu(data: MenuInput): Promise<Resultado<typeof menues.$inferSelect>> {
  try {
    const [fila] = await db.insert(menues).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un menú con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateMenu(id: string, data: MenuInput): Promise<Resultado<typeof menues.$inferSelect>> {
  try {
    const [fila] = await db.update(menues).set(data).where(eq(menues.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un menú con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteMenu(id: string): Promise<Resultado<true>> {
  const [{ value: opcionesCount }] = await db
    .select({ value: count() })
    .from(menuesOpciones)
    .where(eq(menuesOpciones.idMenu, id));
  const [{ value: interfacesCount }] = await db
    .select({ value: count() })
    .from(interfacesMenues)
    .where(eq(interfacesMenues.idMenu, id));

  if (Number(opcionesCount) > 0 || Number(interfacesCount) > 0) {
    const partes: string[] = [];
    if (Number(opcionesCount) > 0) partes.push(`${opcionesCount} opción${Number(opcionesCount) !== 1 ? "es" : ""}`);
    if (Number(interfacesCount) > 0)
      partes.push(`${interfacesCount} interfaz${Number(interfacesCount) !== 1 ? "es" : ""} vinculada${Number(interfacesCount) !== 1 ? "s" : ""}`);
    return { error: `No se puede eliminar: tiene ${partes.join(" y ")}.` };
  }

  await db.delete(menues).where(eq(menues.id, id));
  return { data: true };
}

export interface MenuOpcionConHerramienta {
  id: string;
  idMenu: string | null;
  idHerramienta: string | null;
  codigo: string;
  nombre: string;
  icono: string | null;
  orden: number | null;
  herramientaNombre: string | null;
  // Mismo mecanismo que LAYOUTS_LEGAJO_SOLAPAS.PARAMETROS — ver domain/infraestructura.md.
  parametros: Record<string, unknown> | null;
}

export async function listMenuesOpciones(menuId?: string): Promise<MenuOpcionConHerramienta[]> {
  const base = db
    .select({
      id: menuesOpciones.id,
      idMenu: menuesOpciones.idMenu,
      idHerramienta: menuesOpciones.idHerramienta,
      codigo: menuesOpciones.codigo,
      nombre: menuesOpciones.nombre,
      icono: menuesOpciones.icono,
      orden: menuesOpciones.orden,
      herramientaNombre: herramientas.nombre,
      parametros: menuesOpciones.parametros,
    })
    .from(menuesOpciones)
    .leftJoin(herramientas, eq(herramientas.id, menuesOpciones.idHerramienta));

  if (menuId) return base.where(eq(menuesOpciones.idMenu, menuId));
  return base;
}

export interface MenuOpcionInput {
  idMenu: string;
  idHerramienta: string | null;
  codigo: string;
  nombre: string;
  icono: string | null;
  orden: number | null;
  parametros: Record<string, unknown> | null;
}

export async function createMenuOpcion(
  data: MenuOpcionInput,
): Promise<Resultado<typeof menuesOpciones.$inferSelect>> {
  const [fila] = await db.insert(menuesOpciones).values(data).returning();
  return { data: fila };
}

export async function updateMenuOpcion(
  id: string,
  data: MenuOpcionInput,
): Promise<Resultado<typeof menuesOpciones.$inferSelect>> {
  const [fila] = await db.update(menuesOpciones).set(data).where(eq(menuesOpciones.id, id)).returning();
  return { data: fila };
}

export async function deleteMenuOpcion(id: string): Promise<Resultado<true>> {
  await db.delete(menuesOpciones).where(eq(menuesOpciones.id, id));
  return { data: true };
}
