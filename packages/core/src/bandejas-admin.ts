import { and, eq, count } from "drizzle-orm";
import { db, bandejas, bandejasFiltros, bandejasPerfiles, filtros, perfiles } from "@valgian/db";

/** ABM de BANDEJAS — a diferencia de packages/core/src/bandejas.ts (ejecución de búsquedas). */

export async function listBandejasAdmin() {
  return db.select().from(bandejas).orderBy(bandejas.nombre);
}

export interface BandejaInput {
  codigo: string;
  nombre: string;
  query: string;
  columnas: unknown;
  idLayout: string | null;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createBandeja(data: BandejaInput): Promise<Resultado<typeof bandejas.$inferSelect>> {
  try {
    const [fila] = await db.insert(bandejas).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una bandeja con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateBandeja(id: string, data: BandejaInput): Promise<Resultado<typeof bandejas.$inferSelect>> {
  try {
    const [fila] = await db.update(bandejas).set(data).where(eq(bandejas.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una bandeja con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteBandeja(id: string): Promise<Resultado<true>> {
  const [{ value: filtrosCount }] = await db.select({ value: count() }).from(bandejasFiltros).where(eq(bandejasFiltros.idBandeja, id));
  const [{ value: perfilesCount }] = await db.select({ value: count() }).from(bandejasPerfiles).where(eq(bandejasPerfiles.idBandeja, id));

  if (Number(filtrosCount) > 0 || Number(perfilesCount) > 0) {
    const partes: string[] = [];
    if (Number(filtrosCount) > 0) partes.push(`${filtrosCount} filtro${Number(filtrosCount) !== 1 ? "s" : ""}`);
    if (Number(perfilesCount) > 0) partes.push(`${perfilesCount} perfil${Number(perfilesCount) !== 1 ? "es" : ""}`);
    return { error: `No se puede eliminar: tiene ${partes.join(" y ")} vinculados. Quitalos primero.` };
  }

  await db.delete(bandejas).where(eq(bandejas.id, id));
  return { data: true };
}

export interface BandejaFiltroConNombre {
  id: string;
  idFiltro: string | null;
  campo: string | null;
  orden: number | null;
  filtroCodigo: string | null;
  filtroNombre: string | null;
  filtroTipo: string | null;
}

export async function listBandejaFiltros(bandejaId: string): Promise<BandejaFiltroConNombre[]> {
  return db
    .select({
      id: bandejasFiltros.id,
      idFiltro: bandejasFiltros.idFiltro,
      campo: bandejasFiltros.campo,
      orden: bandejasFiltros.orden,
      filtroCodigo: filtros.codigo,
      filtroNombre: filtros.nombre,
      filtroTipo: filtros.tipo,
    })
    .from(bandejasFiltros)
    .leftJoin(filtros, eq(filtros.id, bandejasFiltros.idFiltro))
    .where(eq(bandejasFiltros.idBandeja, bandejaId))
    .orderBy(bandejasFiltros.orden);
}

export interface BandejaFiltroInput {
  idBandeja: string;
  idFiltro: string;
  campo: string;
  orden: number;
}

export async function createBandejaFiltro(data: BandejaFiltroInput): Promise<Resultado<typeof bandejasFiltros.$inferSelect>> {
  const [fila] = await db.insert(bandejasFiltros).values(data).returning();
  return { data: fila };
}

export async function updateBandejaFiltro(
  id: string,
  data: { idFiltro: string; campo: string; orden: number },
): Promise<Resultado<typeof bandejasFiltros.$inferSelect>> {
  const [fila] = await db.update(bandejasFiltros).set(data).where(eq(bandejasFiltros.id, id)).returning();
  return { data: fila };
}

export async function deleteBandejaFiltro(id: string): Promise<Resultado<true>> {
  await db.delete(bandejasFiltros).where(eq(bandejasFiltros.id, id));
  return { data: true };
}

export interface PerfilConEstado {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

/** Todos los PERFILES existentes, marcando cuáles están vinculados a esta bandeja vía BANDEJAS_PERFILES. */
export async function getPerfilesConEstado(bandejaId: string): Promise<PerfilConEstado[]> {
  const todos = await db.select({ id: perfiles.id, codigo: perfiles.codigo, nombre: perfiles.nombre }).from(perfiles);
  const vinculados = await db
    .select({ idPerfil: bandejasPerfiles.idPerfil })
    .from(bandejasPerfiles)
    .where(eq(bandejasPerfiles.idBandeja, bandejaId));

  const activos = new Set(vinculados.map((v) => v.idPerfil));
  return todos.map((p) => ({ ...p, activo: activos.has(p.id) }));
}

export async function toggleBandejaPerfil(bandejaId: string, perfilId: string, activo: boolean): Promise<Resultado<true>> {
  if (activo) {
    try {
      await db.insert(bandejasPerfiles).values({ idBandeja: bandejaId, idPerfil: perfilId });
    } catch (err) {
      if (!esViolacionUnica(err)) throw err;
    }
  } else {
    await db.delete(bandejasPerfiles).where(and(eq(bandejasPerfiles.idBandeja, bandejaId), eq(bandejasPerfiles.idPerfil, perfilId)));
  }
  return { data: true };
}
