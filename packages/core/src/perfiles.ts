import { count, eq } from "drizzle-orm";
import { db, perfiles, usuarios, permisos } from "@valgian/db";

export interface PerfilConContador {
  id: string;
  codigo: string;
  nombre: string;
  idInterfaz: string | null;
  usuariosCount: number;
}

export async function listPerfiles(): Promise<PerfilConContador[]> {
  const rows = await db
    .select({
      id: perfiles.id,
      codigo: perfiles.codigo,
      nombre: perfiles.nombre,
      idInterfaz: perfiles.idInterfaz,
      usuariosCount: count(usuarios.id),
    })
    .from(perfiles)
    .leftJoin(usuarios, eq(usuarios.idPerfil, perfiles.id))
    .groupBy(perfiles.id, perfiles.codigo, perfiles.nombre, perfiles.idInterfaz);

  return rows.map((r) => ({ ...r, usuariosCount: Number(r.usuariosCount) }));
}

export interface PerfilInput {
  codigo: string;
  nombre: string;
  idInterfaz: string | null;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createPerfil(data: PerfilInput): Promise<Resultado<typeof perfiles.$inferSelect>> {
  try {
    const [perfil] = await db.insert(perfiles).values(data).returning();
    return { data: perfil };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un perfil con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updatePerfil(
  id: string,
  data: PerfilInput,
): Promise<Resultado<typeof perfiles.$inferSelect>> {
  try {
    const [perfil] = await db.update(perfiles).set(data).where(eq(perfiles.id, id)).returning();
    return { data: perfil };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un perfil con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deletePerfil(id: string): Promise<Resultado<true>> {
  const [{ value: usuariosCount }] = await db
    .select({ value: count() })
    .from(usuarios)
    .where(eq(usuarios.idPerfil, id));
  const [{ value: permisosCount }] = await db
    .select({ value: count() })
    .from(permisos)
    .where(eq(permisos.idPerfil, id));

  if (Number(usuariosCount) > 0 || Number(permisosCount) > 0) {
    const partes: string[] = [];
    if (Number(usuariosCount) > 0) partes.push(`${usuariosCount} usuario${Number(usuariosCount) !== 1 ? "s" : ""}`);
    if (Number(permisosCount) > 0) partes.push(`${permisosCount} permiso${Number(permisosCount) !== 1 ? "s" : ""}`);
    const singular = Number(usuariosCount) + Number(permisosCount) === 1;
    return { error: `No se puede eliminar: tiene ${partes.join(" y ")} asociado${singular ? "" : "s"}.` };
  }

  await db.delete(perfiles).where(eq(perfiles.id, id));
  return { data: true };
}
