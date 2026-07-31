import { and, eq } from "drizzle-orm";
import { db, herramientas, operaciones, permisos } from "@valgian/db";

/** Toda herramienta tiene como mínimo esta operación — decide si se ve o no. */
export const OPERACION_ACCESO = "acceso";

/**
 * Única función de chequeo de permisos de toda la app — no debe haber otra
 * forma de consultar PERMISOS. Sin fila para (perfil, operación), no hay
 * permiso; la existencia de la fila ya implica el permiso, no hay booleano
 * adicional. Ver domain/infraestructura.md.
 */
export async function getPermisoParaOperacion(
  perfilId: string,
  herramientaCodigo: string,
  operacionCodigo: string,
): Promise<boolean> {
  const [operacion] = await db
    .select({ id: operaciones.id })
    .from(operaciones)
    .innerJoin(herramientas, eq(herramientas.id, operaciones.idHerramienta))
    .where(and(eq(herramientas.codigo, herramientaCodigo), eq(operaciones.codigo, operacionCodigo)));
  if (!operacion) return false;

  const [permiso] = await db
    .select({ id: permisos.id })
    .from(permisos)
    .where(and(eq(permisos.idPerfil, perfilId), eq(permisos.idOperacion, operacion.id)));

  return !!permiso;
}
