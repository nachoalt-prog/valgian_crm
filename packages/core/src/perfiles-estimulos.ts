import { eq } from "drizzle-orm";
import { db, perfilesEstimulos, perfiles, estimulos, estrategias } from "@valgian/db";

export interface PerfilEstimuloConNombres {
  id: string;
  idPerfil: string | null;
  idEstimulo: string | null;
  perfilCodigo: string | null;
  perfilNombre: string | null;
  estimuloNombre: string | null;
  estrategiaNombre: string | null;
}

export async function listPerfilesEstimulos(): Promise<PerfilEstimuloConNombres[]> {
  return db
    .select({
      id: perfilesEstimulos.id,
      idPerfil: perfilesEstimulos.idPerfil,
      idEstimulo: perfilesEstimulos.idEstimulo,
      perfilCodigo: perfiles.codigo,
      perfilNombre: perfiles.nombre,
      estimuloNombre: estimulos.nombre,
      estrategiaNombre: estrategias.nombre,
    })
    .from(perfilesEstimulos)
    .leftJoin(perfiles, eq(perfiles.id, perfilesEstimulos.idPerfil))
    .leftJoin(estimulos, eq(estimulos.id, perfilesEstimulos.idEstimulo))
    .leftJoin(estrategias, eq(estrategias.id, estimulos.idEstrategia));
}

export interface EstimuloConEstrategia {
  id: string;
  nombre: string;
  estrategiaNombre: string | null;
}

/** Para el selector del ABM: todos los ESTIMULOS con el nombre de su estrategia, ordenados por estrategia y luego estímulo. */
export async function listEstimulosConEstrategia(): Promise<EstimuloConEstrategia[]> {
  return db
    .select({ id: estimulos.id, nombre: estimulos.nombre, estrategiaNombre: estrategias.nombre })
    .from(estimulos)
    .leftJoin(estrategias, eq(estrategias.id, estimulos.idEstrategia))
    .orderBy(estrategias.nombre, estimulos.nombre);
}

export interface PerfilEstimuloInput {
  idPerfil: string;
  idEstimulo: string;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createPerfilEstimulo(data: PerfilEstimuloInput): Promise<Resultado<typeof perfilesEstimulos.$inferSelect>> {
  try {
    const [fila] = await db.insert(perfilesEstimulos).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: "Ya existe ese vínculo entre ese perfil y ese estímulo." };
    throw err;
  }
}

export async function deletePerfilEstimulo(id: string): Promise<Resultado<true>> {
  await db.delete(perfilesEstimulos).where(eq(perfilesEstimulos.id, id));
  return { data: true };
}
