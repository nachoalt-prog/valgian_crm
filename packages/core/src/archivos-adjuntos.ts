import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { eq, and } from "drizzle-orm";
import { db, archivosAdjuntos, tiposArchivosAdjuntos } from "@valgian/db";

/**
 * Storage de archivos adjuntos — ver ADR 0011. El archivo real vive siempre
 * en el filesystem de la instancia, nunca en la base; ARCHIVOS_ADJUNTOS solo
 * guarda metadata + la ruta relativa (RUTA_ARCHIVO).
 *
 * Reglas de consistencia acordadas (no aflojar sin repensarlas):
 * - Alta: se crea la fila primero (ya con su RUTA_ARCHIVO calculada a partir
 *   del ID), y recién después se escribe el archivo. Si la escritura falla,
 *   se borra la fila — nunca puede quedar una fila sin archivo real detrás.
 * - Toda escritura (alta o reemplazo) pasa por un archivo temporal en el
 *   mismo shard + `fs.rename` (atómico en POSIX y en Windows) al path final
 *   — nunca hay una ventana donde el path final tenga contenido a medio
 *   escribir.
 * - Reemplazo: el UPDATE de metadata y el rename van atados a una
 *   transacción — si el rename falla, se hace rollback del UPDATE y se
 *   borra el temporal; si sale bien, se borra (best-effort) el archivo
 *   viejo si cambió de extensión.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../../");
const UPLOADS_DIR = path.resolve(MONOREPO_ROOT, process.env.UPLOADS_DIR ?? "apps/web/uploads");
const ADJUNTOS_SUBDIR = "adjuntos";

interface Resultado<T> {
  data?: T;
  error?: string;
}

function extensionDe(nombreOriginal: string): string {
  return path.extname(nombreOriginal).replace(/^\./, "").toLowerCase();
}

function shardYRuta(id: string, extension: string) {
  const shard = id.charAt(0).toLowerCase();
  const rutaRelativa = `${ADJUNTOS_SUBDIR}/${shard}/${id}.${extension}`;
  return { shard, rutaRelativa };
}

async function getTipoPorExtensionYMimetype(extension: string, mimetype: string) {
  const [tipo] = await db
    .select()
    .from(tiposArchivosAdjuntos)
    .where(and(eq(tiposArchivosAdjuntos.extension, extension), eq(tiposArchivosAdjuntos.mimetype, mimetype)));
  return tipo ?? null;
}

async function escribirAtomico(rutaRelativa: string, buffer: Buffer): Promise<void> {
  const rutaAbsoluta = path.join(UPLOADS_DIR, rutaRelativa);
  await fs.mkdir(path.dirname(rutaAbsoluta), { recursive: true });
  const tempPath = `${rutaAbsoluta}.tmp-${crypto.randomBytes(4).toString("hex")}`;
  await fs.writeFile(tempPath, buffer);
  await fs.rename(tempPath, rutaAbsoluta);
}

export interface GuardarArchivoInput {
  idEntidad: string;
  idRegistro: string;
  buffer: Buffer;
  nombreOriginal: string;
  mimetype: string;
  idUsuario: string;
}

/** Alta de un archivo adjunto nuevo — ver reglas de consistencia arriba. */
export async function guardarArchivo(input: GuardarArchivoInput): Promise<Resultado<{ id: string }>> {
  const extension = extensionDe(input.nombreOriginal);
  const tipo = await getTipoPorExtensionYMimetype(extension, input.mimetype);
  if (!tipo) return { error: `Tipo de archivo no soportado (extensión "${extension || "?"}", ${input.mimetype}).` };
  if (!tipo.permiteCarga) return { error: `El tipo de archivo "${tipo.nombre}" no admite carga.` };

  const id = crypto.randomUUID();
  const { rutaRelativa } = shardYRuta(id, extension);
  const ahora = new Date();

  const [fila] = await db
    .insert(archivosAdjuntos)
    .values({
      id,
      idEntidad: input.idEntidad,
      idRegistro: input.idRegistro,
      idTipoArchivoAdjunto: tipo.id,
      nombreOriginal: input.nombreOriginal,
      rutaArchivo: rutaRelativa,
      tamanioBytes: input.buffer.length,
      altaFecha: ahora,
      altaUsuario: input.idUsuario,
      auditFecha: ahora,
      auditUsuario: input.idUsuario,
    })
    .returning();

  try {
    await escribirAtomico(rutaRelativa, input.buffer);
  } catch (err) {
    await db.delete(archivosAdjuntos).where(eq(archivosAdjuntos.id, fila.id));
    const message = err instanceof Error ? err.message : "Error guardando el archivo en disco.";
    return { error: message };
  }

  return { data: { id: fila.id } };
}

export interface ReemplazarArchivoInput {
  id: string;
  buffer: Buffer;
  nombreOriginal: string;
  mimetype: string;
  idUsuario: string;
}

/** Reemplaza el archivo de una fila ya existente — el ID nunca cambia (no rompe FKs como USUARIOS.ID_ARCHIVO_ADJUNTO). */
export async function reemplazarArchivo(input: ReemplazarArchivoInput): Promise<Resultado<{ id: string }>> {
  const [existente] = await db.select().from(archivosAdjuntos).where(eq(archivosAdjuntos.id, input.id));
  if (!existente) return { error: "No existe el archivo adjunto a reemplazar." };

  const extension = extensionDe(input.nombreOriginal);
  const tipo = await getTipoPorExtensionYMimetype(extension, input.mimetype);
  if (!tipo) return { error: `Tipo de archivo no soportado (extensión "${extension || "?"}", ${input.mimetype}).` };
  if (!tipo.permiteCarga) return { error: `El tipo de archivo "${tipo.nombre}" no admite carga.` };

  const { rutaRelativa } = shardYRuta(input.id, extension);
  const rutaAbsolutaFinal = path.join(UPLOADS_DIR, rutaRelativa);
  await fs.mkdir(path.dirname(rutaAbsolutaFinal), { recursive: true });
  const tempPath = `${rutaAbsolutaFinal}.tmp-${crypto.randomBytes(4).toString("hex")}`;
  await fs.writeFile(tempPath, input.buffer);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(archivosAdjuntos)
        .set({
          idTipoArchivoAdjunto: tipo.id,
          nombreOriginal: input.nombreOriginal,
          rutaArchivo: rutaRelativa,
          tamanioBytes: input.buffer.length,
          auditFecha: new Date(),
          auditUsuario: input.idUsuario,
        })
        .where(eq(archivosAdjuntos.id, input.id));

      // El rename queda DENTRO de la transacción a propósito: si tira, drizzle
      // hace rollback del UPDATE y el catch de abajo limpia el temporal —
      // quedan la fila y el archivo viejos exactamente como estaban.
      await fs.rename(tempPath, rutaAbsolutaFinal);
    });
  } catch (err) {
    await fs.unlink(tempPath).catch(() => {});
    const message = err instanceof Error ? err.message : "Error reemplazando el archivo.";
    return { error: message };
  }

  // Best-effort: si cambió la extensión, el archivo viejo quedó en otro path.
  if (existente.rutaArchivo && existente.rutaArchivo !== rutaRelativa) {
    await fs.unlink(path.join(UPLOADS_DIR, existente.rutaArchivo)).catch(() => {});
  }

  return { data: { id: input.id } };
}

/** Borra la fila y el archivo — el archivo se borra PRIMERO: si algo falla a mitad de camino, es preferible una fila sin archivo (visible, se puede reintentar) a un archivo sin fila (invisible, sin forma de encontrarlo). */
export async function borrarArchivo(id: string): Promise<Resultado<true>> {
  const [existente] = await db.select().from(archivosAdjuntos).where(eq(archivosAdjuntos.id, id));
  if (!existente) return { error: "No existe el archivo adjunto." };

  if (existente.rutaArchivo) {
    await fs.unlink(path.join(UPLOADS_DIR, existente.rutaArchivo)).catch(() => {});
  }
  await db.delete(archivosAdjuntos).where(eq(archivosAdjuntos.id, id));
  return { data: true };
}

export interface ArchivoAdjuntoDetalle {
  id: string;
  idEntidad: string | null;
  idRegistro: string | null;
  nombreOriginal: string | null;
  tamanioBytes: number | null;
  tipoCodigo: string | null;
  extension: string | null;
  mimetype: string | null;
  renderizar: boolean | null;
  permiteDownload: boolean | null;
}

const SELECT_DETALLE = {
  id: archivosAdjuntos.id,
  idEntidad: archivosAdjuntos.idEntidad,
  idRegistro: archivosAdjuntos.idRegistro,
  nombreOriginal: archivosAdjuntos.nombreOriginal,
  tamanioBytes: archivosAdjuntos.tamanioBytes,
  tipoCodigo: tiposArchivosAdjuntos.codigo,
  extension: tiposArchivosAdjuntos.extension,
  mimetype: tiposArchivosAdjuntos.mimetype,
  renderizar: tiposArchivosAdjuntos.renderizar,
  permiteDownload: tiposArchivosAdjuntos.permiteDownload,
} as const;

export async function getArchivoAdjunto(id: string): Promise<ArchivoAdjuntoDetalle | null> {
  const [fila] = await db
    .select(SELECT_DETALLE)
    .from(archivosAdjuntos)
    .leftJoin(tiposArchivosAdjuntos, eq(tiposArchivosAdjuntos.id, archivosAdjuntos.idTipoArchivoAdjunto))
    .where(eq(archivosAdjuntos.id, id));
  return fila ?? null;
}

/** Todos los adjuntos de un registro — ARCHIVOS_ADJUNTOS admite varias filas para el mismo (ID_ENTIDAD, ID_REGISTRO). */
export async function listArchivosAdjuntos(idEntidad: string, idRegistro: string): Promise<ArchivoAdjuntoDetalle[]> {
  return db
    .select(SELECT_DETALLE)
    .from(archivosAdjuntos)
    .leftJoin(tiposArchivosAdjuntos, eq(tiposArchivosAdjuntos.id, archivosAdjuntos.idTipoArchivoAdjunto))
    .where(and(eq(archivosAdjuntos.idEntidad, idEntidad), eq(archivosAdjuntos.idRegistro, idRegistro)));
}

export interface ArchivoParaDescarga {
  buffer: Buffer;
  nombreOriginal: string;
  mimetype: string | null;
}

/** Lee el archivo de disco para servirlo — valida PERMITE_DOWNLOAD acá adentro, no confiar en que el llamador ya lo chequeó. */
export async function leerArchivoParaDescarga(id: string): Promise<Resultado<ArchivoParaDescarga>> {
  const [fila] = await db
    .select({
      rutaArchivo: archivosAdjuntos.rutaArchivo,
      nombreOriginal: archivosAdjuntos.nombreOriginal,
      mimetype: tiposArchivosAdjuntos.mimetype,
      permiteDownload: tiposArchivosAdjuntos.permiteDownload,
    })
    .from(archivosAdjuntos)
    .leftJoin(tiposArchivosAdjuntos, eq(tiposArchivosAdjuntos.id, archivosAdjuntos.idTipoArchivoAdjunto))
    .where(eq(archivosAdjuntos.id, id));

  if (!fila || !fila.rutaArchivo) return { error: "No existe el archivo adjunto." };
  if (!fila.permiteDownload) return { error: "Este tipo de archivo no admite descarga." };

  const buffer = await fs.readFile(path.join(UPLOADS_DIR, fila.rutaArchivo));
  return { data: { buffer, nombreOriginal: fila.nombreOriginal ?? "archivo", mimetype: fila.mimetype } };
}
