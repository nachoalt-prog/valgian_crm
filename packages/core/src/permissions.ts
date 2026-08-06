import { and, eq, inArray } from "drizzle-orm";
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

/**
 * Versión batcheada de getPermisoParaOperacion — resuelve de una sola vez el
 * acceso a la MISMA operación (normalmente "acceso") en varias herramientas
 * distintas, en vez de N round-trips secuenciales (ej. al filtrar las
 * solapas de un layout de legajo según el perfil actual, ver
 * layouts-legajo.ts). Mismo criterio "sin fila en PERMISOS, sin acceso" que
 * la versión simple — no una forma alternativa de decidir permisos, solo
 * batchea la misma consulta.
 */
export async function getPermisosParaHerramientas(
  perfilId: string,
  herramientaCodigos: string[],
  operacionCodigo: string,
): Promise<Set<string>> {
  if (herramientaCodigos.length === 0) return new Set();

  const filas = await db
    .select({ herramientaCodigo: herramientas.codigo })
    .from(permisos)
    .innerJoin(operaciones, eq(operaciones.id, permisos.idOperacion))
    .innerJoin(herramientas, eq(herramientas.id, operaciones.idHerramienta))
    .where(and(eq(permisos.idPerfil, perfilId), eq(operaciones.codigo, operacionCodigo), inArray(herramientas.codigo, herramientaCodigos)));

  return new Set(filas.map((f) => f.herramientaCodigo));
}
