import { eq } from "drizzle-orm";
import { db, entidades } from "@valgian/db";

export async function listEntidades() {
  return db.select().from(entidades).orderBy(entidades.nombre);
}

export async function getEntidadPorCodigo(codigo: string) {
  const [entidad] = await db.select().from(entidades).where(eq(entidades.codigo, codigo));
  return entidad ?? null;
}
