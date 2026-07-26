import { eq, and, sql } from "drizzle-orm";
import { db, entidades, estados, estimulos, transiciones, perfilesEstimulos } from "@valgian/db";

const IDENTIFICADOR_VALIDO = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validarIdentificador(nombre: string): void {
  if (!IDENTIFICADOR_VALIDO.test(nombre)) {
    throw new Error(`Nombre de tabla inválido: "${nombre}".`);
  }
}

async function getEstadoActual(idEntidad: string, idRelacion: string): Promise<{ id: string; nombre: string } | null> {
  const [entidad] = await db.select().from(entidades).where(eq(entidades.id, idEntidad));
  if (!entidad) return null;
  validarIdentificador(entidad.nombre);

  const tabla = sql.raw(`"${entidad.nombre}"`);
  const [fila] = await db.execute<{ id_estado: string | null }>(
    sql`SELECT "ID_ESTADO" AS id_estado FROM ${tabla} WHERE "ID" = ${idRelacion}`,
  );
  if (!fila?.id_estado) return null;

  const [estado] = await db.select().from(estados).where(eq(estados.id, fila.id_estado));
  if (!estado) return null;
  return { id: estado.id, nombre: estado.nombre };
}

export interface EstadoActual {
  id: string;
  nombre: string;
}

export interface EstimuloDisponible {
  id: string;
  codigo: string;
  nombre: string;
}

export interface EstimulosDisponiblesResult {
  estadoActual: EstadoActual | null;
  estimulos: EstimuloDisponible[];
}

/**
 * Estímulos aplicables desde el estado actual de un registro, filtrados a los
 * que el perfil puede aplicar según PERFILES_ESTIMULOS — ver domain/motor-de-estados.md.
 */
export async function getEstimulosDisponibles(idEntidad: string, idRelacion: string, perfilId: string): Promise<EstimulosDisponiblesResult> {
  const estadoActual = await getEstadoActual(idEntidad, idRelacion);
  if (!estadoActual) return { estadoActual: null, estimulos: [] };

  const transicionesDesdeEstado = await db
    .select({ id: estimulos.id, codigo: estimulos.codigo, nombre: estimulos.nombre })
    .from(transiciones)
    .innerJoin(estimulos, eq(estimulos.id, transiciones.idEstimulo))
    .where(eq(transiciones.idEstado0, estadoActual.id));

  const disponibles: EstimuloDisponible[] = [];
  for (const e of transicionesDesdeEstado) {
    const [permiso] = await db
      .select()
      .from(perfilesEstimulos)
      .where(and(eq(perfilesEstimulos.idPerfil, perfilId), eq(perfilesEstimulos.idEstimulo, e.id)));
    if (permiso) disponibles.push(e);
  }

  return { estadoActual, estimulos: disponibles };
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

/** Ejecuta SP_APLICAR_ESTIMULO — ver packages/db/sql/0002_sp_aplicar_estimulo.sql. */
export async function aplicarEstimulo(
  idEntidad: string,
  idRelacion: string,
  idEstimulo: string,
  idUsuario: string,
  observacion: string | null,
): Promise<Resultado<true>> {
  try {
    await db.execute(sql`CALL sp_aplicar_estimulo(${idEntidad}, ${idRelacion}, ${idEstimulo}, ${idUsuario}, ${observacion})`);
    return { data: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error aplicando el estímulo.";
    return { error: message };
  }
}
