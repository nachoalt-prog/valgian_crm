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

const MODALIDADES_ALMACENAMIENTO_SOPORTADAS = ["filesystem"] as const;
type ModalidadAlmacenamiento = (typeof MODALIDADES_ALMACENAMIENTO_SOPORTADAS)[number];

/**
 * Config de INFRAESTRUCTURA por instalación (no de negocio) — vive en .env,
 * mismo criterio que UPLOADS_DIR, no en una tabla (ver candidato a ADR 0013).
 * Hoy solo existe "filesystem"; queda preparado el punto de ramificación en
 * escribirAtomico/reemplazarArchivo/borrarArchivo/leerArchivoCrudo para el
 * día que haga falta un segundo modo (ej. "s3") — sin switch/interfaz/clase
 * todavía, no se usa ese estilo en el resto de packages/core y nadie puede
 * probar de verdad un modo que no tiene una instalación real que lo necesite.
 */
export function getModalidadAlmacenamiento(): ModalidadAlmacenamiento {
  const valor = process.env.MODALIDAD_ALMACENAMIENTO_ADJUNTOS ?? "filesystem";
  if (!(MODALIDADES_ALMACENAMIENTO_SOPORTADAS as readonly string[]).includes(valor)) {
    throw new Error(
      `MODALIDAD_ALMACENAMIENTO_ADJUNTOS="${valor}" no está soportada. Valores válidos: ${MODALIDADES_ALMACENAMIENTO_SOPORTADAS.join(", ")}.`,
    );
  }
  return valor as ModalidadAlmacenamiento;
}

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

// Punto de ramificación por MODALIDAD_ALMACENAMIENTO_ADJUNTOS (ver getModalidadAlmacenamiento) — hoy solo escribe a disco.
async function escribirAtomico(rutaRelativa: string, buffer: Buffer): Promise<void> {
  const rutaAbsoluta = path.join(UPLOADS_DIR, rutaRelativa);
  await fs.mkdir(path.dirname(rutaAbsoluta), { recursive: true });
  const tempPath = `${rutaAbsoluta}.tmp-${crypto.randomBytes(4).toString("hex")}`;
  await fs.writeFile(tempPath, buffer);
  await fs.rename(tempPath, rutaAbsoluta);
}

/** Si `tiposPermitidos` viene con algo, el CODIGO del tipo matcheado tiene que estar en la lista — ej. la ventanita de plantillas solo admite "html". */
function validarTipoPermitido(tipo: { codigo: string; nombre: string }, tiposPermitidos?: string[]): string | null {
  if (!tiposPermitidos || tiposPermitidos.length === 0) return null;
  if (tiposPermitidos.includes(tipo.codigo)) return null;
  return `Este campo solo admite: ${tiposPermitidos.join(", ")}.`;
}

export interface GuardarArchivoInput {
  // NULL para archivos globales sin registro dueño (ej. PLANTILLAS_ADJUNTOS,
  // identificados por su propio CODIGO, no por un ID_ENTIDAD/ID_REGISTRO).
  idEntidad?: string | null;
  idRegistro?: string | null;
  buffer: Buffer;
  nombreOriginal: string;
  mimetype: string;
  // NULL para archivos generados por el propio sistema (ej. PDFs armados por
  // la generación de documentos) — no hay un usuario humano detrás.
  idUsuario?: string | null;
  // Restringe a estos CODIGO de TIPOS_ARCHIVOS_ADJUNTOS (ej. ["html"] para plantillas). Sin restricción si se omite.
  tiposPermitidos?: string[];
}

/** Alta de un archivo adjunto nuevo — ver reglas de consistencia arriba. */
export async function guardarArchivo(input: GuardarArchivoInput): Promise<Resultado<{ id: string }>> {
  const extension = extensionDe(input.nombreOriginal);
  const tipo = await getTipoPorExtensionYMimetype(extension, input.mimetype);
  if (!tipo) return { error: `Tipo de archivo no soportado (extensión "${extension || "?"}", ${input.mimetype}).` };
  if (!tipo.permiteCarga) return { error: `El tipo de archivo "${tipo.nombre}" no admite carga.` };
  {
    const errorTipoPermitido = validarTipoPermitido(tipo, input.tiposPermitidos);
    if (errorTipoPermitido) return { error: errorTipoPermitido };
  }

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
  // Restringe a estos CODIGO de TIPOS_ARCHIVOS_ADJUNTOS (ej. ["html"] para plantillas). Sin restricción si se omite.
  tiposPermitidos?: string[];
}

/**
 * Reemplaza el archivo de una fila ya existente — el ID nunca cambia (no rompe FKs como USUARIOS.ID_ARCHIVO_ADJUNTO).
 * Punto de ramificación por MODALIDAD_ALMACENAMIENTO_ADJUNTOS — hoy escribe a disco (temp + rename dentro de la transacción, ver comentario más abajo).
 */
export async function reemplazarArchivo(input: ReemplazarArchivoInput): Promise<Resultado<{ id: string }>> {
  const [existente] = await db.select().from(archivosAdjuntos).where(eq(archivosAdjuntos.id, input.id));
  if (!existente) return { error: "No existe el archivo adjunto a reemplazar." };

  const extension = extensionDe(input.nombreOriginal);
  const tipo = await getTipoPorExtensionYMimetype(extension, input.mimetype);
  if (!tipo) return { error: `Tipo de archivo no soportado (extensión "${extension || "?"}", ${input.mimetype}).` };
  if (!tipo.permiteCarga) return { error: `El tipo de archivo "${tipo.nombre}" no admite carga.` };
  {
    const errorTipoPermitido = validarTipoPermitido(tipo, input.tiposPermitidos);
    if (errorTipoPermitido) return { error: errorTipoPermitido };
  }

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

/**
 * Borra la fila y el archivo — el archivo se borra PRIMERO: si algo falla a mitad de camino, es preferible una fila sin archivo (visible, se puede reintentar) a un archivo sin fila (invisible, sin forma de encontrarlo).
 * Punto de ramificación por MODALIDAD_ALMACENAMIENTO_ADJUNTOS — hoy borra de disco.
 */
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

/**
 * Lee los bytes de disco sin validar PERMITE_DOWNLOAD — ese flag es sobre si
 * un usuario final puede bajarse el archivo desde la UI, no sobre si el
 * propio sistema puede leerlo para procesarlo internamente (ej. el HTML de
 * una PLANTILLAS_ADJUNTOS al generar un documento). Uso interno — el route
 * handler de descarga usa `leerArchivoParaDescarga`, no esta función directo.
 * Punto de ramificación por MODALIDAD_ALMACENAMIENTO_ADJUNTOS — hoy lee de disco.
 */
export async function leerArchivoCrudo(id: string): Promise<Resultado<ArchivoParaDescarga>> {
  const [fila] = await db
    .select({
      rutaArchivo: archivosAdjuntos.rutaArchivo,
      nombreOriginal: archivosAdjuntos.nombreOriginal,
      mimetype: tiposArchivosAdjuntos.mimetype,
    })
    .from(archivosAdjuntos)
    .leftJoin(tiposArchivosAdjuntos, eq(tiposArchivosAdjuntos.id, archivosAdjuntos.idTipoArchivoAdjunto))
    .where(eq(archivosAdjuntos.id, id));

  if (!fila || !fila.rutaArchivo) return { error: "No existe el archivo adjunto." };

  const buffer = await fs.readFile(path.join(UPLOADS_DIR, fila.rutaArchivo));
  return { data: { buffer, nombreOriginal: fila.nombreOriginal ?? "archivo", mimetype: fila.mimetype } };
}

/** Lee el archivo de disco para servirlo por descarga — valida PERMITE_DOWNLOAD acá adentro, no confiar en que el llamador ya lo chequeó. */
export async function leerArchivoParaDescarga(id: string): Promise<Resultado<ArchivoParaDescarga>> {
  const [fila] = await db
    .select({ permiteDownload: tiposArchivosAdjuntos.permiteDownload })
    .from(archivosAdjuntos)
    .leftJoin(tiposArchivosAdjuntos, eq(tiposArchivosAdjuntos.id, archivosAdjuntos.idTipoArchivoAdjunto))
    .where(eq(archivosAdjuntos.id, id));

  if (!fila) return { error: "No existe el archivo adjunto." };
  if (!fila.permiteDownload) return { error: "Este tipo de archivo no admite descarga." };

  return leerArchivoCrudo(id);
}
