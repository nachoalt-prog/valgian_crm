import { eq } from "drizzle-orm";
import { db, permisos, perfiles, herramientas, operaciones } from "@valgian/db";
import { OPERACION_ACCESO } from "./permissions";

export interface PermisoConNombres {
  id: string;
  idPerfil: string | null;
  idOperacion: string | null;
  perfilCodigo: string | null;
  perfilNombre: string | null;
  idHerramienta: string | null;
  herramientaCodigo: string | null;
  herramientaNombre: string | null;
  operacionCodigo: string | null;
  operacionNombre: string | null;
}

export async function listPermisos(): Promise<PermisoConNombres[]> {
  return db
    .select({
      id: permisos.id,
      idPerfil: permisos.idPerfil,
      idOperacion: permisos.idOperacion,
      perfilCodigo: perfiles.codigo,
      perfilNombre: perfiles.nombre,
      idHerramienta: herramientas.id,
      herramientaCodigo: herramientas.codigo,
      herramientaNombre: herramientas.nombre,
      operacionCodigo: operaciones.codigo,
      operacionNombre: operaciones.nombre,
    })
    .from(permisos)
    .leftJoin(perfiles, eq(perfiles.id, permisos.idPerfil))
    .leftJoin(operaciones, eq(operaciones.id, permisos.idOperacion))
    .leftJoin(herramientas, eq(herramientas.id, operaciones.idHerramienta));
}

export interface OperacionOption {
  id: string;
  codigo: string;
  nombre: string;
  idHerramienta: string | null;
}

/** Todas las OPERACIONES, para que el modal filtre client-side según la herramienta elegida. */
export async function listOperaciones(): Promise<OperacionOption[]> {
  return db
    .select({ id: operaciones.id, codigo: operaciones.codigo, nombre: operaciones.nombre, idHerramienta: operaciones.idHerramienta })
    .from(operaciones);
}

export interface PermisoInput {
  idPerfil: string;
  idOperacion: string;
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
    if (esViolacionUnica(err)) return { error: "Ya existe un permiso para ese perfil y esa operación." };
    throw err;
  }
}

export async function updatePermiso(id: string, idOperacion: string): Promise<Resultado<typeof permisos.$inferSelect>> {
  try {
    const [fila] = await db.update(permisos).set({ idOperacion }).where(eq(permisos.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: "Ya existe un permiso para ese perfil y esa operación." };
    throw err;
  }
}

export async function deletePermiso(id: string, currentPerfilId: string): Promise<Resultado<true>> {
  const [fila] = await db
    .select({ idPerfil: permisos.idPerfil, herramientaCodigo: herramientas.codigo, operacionCodigo: operaciones.codigo })
    .from(permisos)
    .leftJoin(operaciones, eq(operaciones.id, permisos.idOperacion))
    .leftJoin(herramientas, eq(herramientas.id, operaciones.idHerramienta))
    .where(eq(permisos.id, id));

  if (!fila) return { error: "El permiso ya no existe." };

  const esPropioAccesoAPermisos =
    fila.idPerfil === currentPerfilId && fila.herramientaCodigo === "permisos" && fila.operacionCodigo === OPERACION_ACCESO;
  if (esPropioAccesoAPermisos) {
    return {
      error: "No podés eliminar tu propio acceso a Permisos — te dejaría sin acceso a esta herramienta.",
    };
  }

  await db.delete(permisos).where(eq(permisos.id, id));
  return { data: true };
}
