import { and, eq } from "drizzle-orm";
import { db, herramientas, permisos } from "@valgian/db";

export interface Permiso {
  gestionar: boolean;
}

/**
 * Si no hay fila en PERMISOS para (perfil, herramienta), devuelve null — sin acceso.
 * La existencia de la fila ya implica acceso de lectura (no hay columna VER separada).
 * Ver domain/infraestructura.md: HERRAMIENTAS es el catálogo central de todo lo permisable.
 */
export async function getPermisoParaHerramienta(
  perfilId: string,
  herramientaCodigo: string,
): Promise<Permiso | null> {
  const [herramienta] = await db.select().from(herramientas).where(eq(herramientas.codigo, herramientaCodigo));
  if (!herramienta) return null;

  const [permiso] = await db
    .select()
    .from(permisos)
    .where(and(eq(permisos.idPerfil, perfilId), eq(permisos.idHerramienta, herramienta.id)));

  if (!permiso) return null;

  return { gestionar: permiso.gestionar ?? false };
}
