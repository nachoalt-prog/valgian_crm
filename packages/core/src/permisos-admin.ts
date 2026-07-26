import { eq } from "drizzle-orm";
import { db, permisos, perfiles, herramientas } from "@valgian/db";

export interface PermisoConNombres {
  id: string;
  idPerfil: string | null;
  idHerramienta: string | null;
  gestionar: boolean | null;
  perfilCodigo: string | null;
  perfilNombre: string | null;
  herramientaCodigo: string | null;
  herramientaNombre: string | null;
}

export async function listPermisos(): Promise<PermisoConNombres[]> {
  return db
    .select({
      id: permisos.id,
      idPerfil: permisos.idPerfil,
      idHerramienta: permisos.idHerramienta,
      gestionar: permisos.gestionar,
      perfilCodigo: perfiles.codigo,
      perfilNombre: perfiles.nombre,
      herramientaCodigo: herramientas.codigo,
      herramientaNombre: herramientas.nombre,
    })
    .from(permisos)
    .leftJoin(perfiles, eq(perfiles.id, permisos.idPerfil))
    .leftJoin(herramientas, eq(herramientas.id, permisos.idHerramienta));
}

export interface PermisoInput {
  idPerfil: string;
  idHerramienta: string;
  gestionar: boolean;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createPermiso(data: PermisoInput): Promise<Resultado<typeof permisos.$inferSelect>> {
  try {
    const [fila] = await db.insert(permisos).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: "Ya existe un permiso para ese perfil y esa herramienta." };
    throw err;
  }
}

export async function updatePermiso(id: string, gestionar: boolean): Promise<Resultado<typeof permisos.$inferSelect>> {
  const [fila] = await db.update(permisos).set({ gestionar }).where(eq(permisos.id, id)).returning();
  return { data: fila };
}

export async function deletePermiso(id: string, currentPerfilId: string): Promise<Resultado<true>> {
  const [fila] = await db
    .select({ idPerfil: permisos.idPerfil, herramientaCodigo: herramientas.codigo })
    .from(permisos)
    .leftJoin(herramientas, eq(herramientas.id, permisos.idHerramienta))
    .where(eq(permisos.id, id));

  if (!fila) return { error: "El permiso ya no existe." };

  if (fila.idPerfil === currentPerfilId && fila.herramientaCodigo === "permisos") {
    return {
      error: "No podés eliminar tu propio permiso de gestión sobre Permisos — te dejaría sin acceso a esta herramienta.",
    };
  }

  await db.delete(permisos).where(eq(permisos.id, id));
  return { data: true };
}
