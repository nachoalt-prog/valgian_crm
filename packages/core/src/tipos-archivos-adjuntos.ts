import { eq, count } from "drizzle-orm";
import { db, tiposArchivosAdjuntos, archivosAdjuntos } from "@valgian/db";

export async function listTiposArchivosAdjuntos() {
  return db.select().from(tiposArchivosAdjuntos).orderBy(tiposArchivosAdjuntos.nombre);
}

export interface TipoArchivoAdjuntoInput {
  codigo: string;
  nombre: string;
  extension: string | null;
  mimetype: string | null;
  permiteCarga: boolean;
  permiteDownload: boolean;
  renderizar: boolean;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createTipoArchivoAdjunto(data: TipoArchivoAdjuntoInput): Promise<Resultado<typeof tiposArchivosAdjuntos.$inferSelect>> {
  try {
    const [fila] = await db.insert(tiposArchivosAdjuntos).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un tipo de adjunto con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateTipoArchivoAdjunto(
  id: string,
  data: TipoArchivoAdjuntoInput,
): Promise<Resultado<typeof tiposArchivosAdjuntos.$inferSelect>> {
  try {
    const [fila] = await db.update(tiposArchivosAdjuntos).set(data).where(eq(tiposArchivosAdjuntos.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un tipo de adjunto con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteTipoArchivoAdjunto(id: string): Promise<Resultado<true>> {
  const [{ value: usosCount }] = await db
    .select({ value: count() })
    .from(archivosAdjuntos)
    .where(eq(archivosAdjuntos.idTipoArchivoAdjunto, id));

  if (Number(usosCount) > 0) {
    return { error: `No se puede eliminar: hay ${usosCount} archivo${Number(usosCount) !== 1 ? "s" : ""} adjunto${Number(usosCount) !== 1 ? "s" : ""} de este tipo.` };
  }

  await db.delete(tiposArchivosAdjuntos).where(eq(tiposArchivosAdjuntos.id, id));
  return { data: true };
}
