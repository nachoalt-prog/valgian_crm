import { eq } from "drizzle-orm";
import { db, mensajeriaPlantillas } from "@valgian/db";
import { guardarArchivo, borrarArchivo, leerArchivoCrudo } from "./archivos-adjuntos";
import { extraerCodigosPlaceholders } from "./placeholders";

interface Resultado<T> {
  data?: T;
  error?: string;
}

export interface MensajeriaPlantillaDetalle {
  id: string;
  idArchivoAdjunto: string | null;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  asunto: string | null;
  idEstimuloOk: string | null;
  observacionOk: string | null;
  idEstimuloError: string | null;
  observacionError: string | null;
}

export async function getMensajeriaPlantillaPorCodigo(codigo: string): Promise<MensajeriaPlantillaDetalle | null> {
  const [fila] = await db.select().from(mensajeriaPlantillas).where(eq(mensajeriaPlantillas.codigo, codigo));
  return fila ?? null;
}

export async function getMensajeriaPlantillaPorId(id: string): Promise<MensajeriaPlantillaDetalle | null> {
  const [fila] = await db.select().from(mensajeriaPlantillas).where(eq(mensajeriaPlantillas.id, id));
  return fila ?? null;
}

export async function listMensajeriaPlantillas(): Promise<MensajeriaPlantillaDetalle[]> {
  return db.select().from(mensajeriaPlantillas).orderBy(mensajeriaPlantillas.nombre);
}

export interface CrearMensajeriaPlantillaInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  asunto?: string | null;
  idEstimuloOk?: string | null;
  observacionOk?: string | null;
  idEstimuloError?: string | null;
  observacionError?: string | null;
  buffer: Buffer;
  nombreOriginal: string;
  mimetype: string;
  idUsuario: string;
}

/** Alta de una plantilla — el ARCHIVOS_ADJUNTOS resultante queda con ID_ENTIDAD/ID_REGISTRO en NULL (es global, se identifica por CODIGO). */
export async function crearMensajeriaPlantilla(input: CrearMensajeriaPlantillaInput): Promise<Resultado<{ id: string }>> {
  const existente = await getMensajeriaPlantillaPorCodigo(input.codigo);
  if (existente) return { error: `Ya existe una plantilla de mensajería con el código "${input.codigo}".` };

  const archivo = await guardarArchivo({
    idEntidad: null,
    idRegistro: null,
    buffer: input.buffer,
    nombreOriginal: input.nombreOriginal,
    mimetype: input.mimetype,
    idUsuario: input.idUsuario,
    tiposPermitidos: ["html"],
  });
  if (archivo.error || !archivo.data) return { error: archivo.error ?? "Error guardando el archivo de la plantilla." };

  const [fila] = await db
    .insert(mensajeriaPlantillas)
    .values({
      idArchivoAdjunto: archivo.data.id,
      codigo: input.codigo,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      asunto: input.asunto ?? null,
      idEstimuloOk: input.idEstimuloOk ?? null,
      observacionOk: input.observacionOk ?? null,
      idEstimuloError: input.idEstimuloError ?? null,
      observacionError: input.observacionError ?? null,
    })
    .returning();

  return { data: { id: fila.id } };
}

export interface ActualizarMensajeriaPlantillaInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  asunto?: string | null;
  idEstimuloOk?: string | null;
  observacionOk?: string | null;
  idEstimuloError?: string | null;
  observacionError?: string | null;
}

/** Edita la metadata — el archivo se reemplaza vía el modal de adjuntos, no acá (mismo criterio que Plantillas de Documento). */
export async function actualizarMensajeriaPlantilla(id: string, input: ActualizarMensajeriaPlantillaInput): Promise<Resultado<true>> {
  const existente = await getMensajeriaPlantillaPorCodigo(input.codigo);
  if (existente && existente.id !== id) return { error: `Ya existe una plantilla de mensajería con el código "${input.codigo}".` };

  await db
    .update(mensajeriaPlantillas)
    .set({
      codigo: input.codigo,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      asunto: input.asunto ?? null,
      idEstimuloOk: input.idEstimuloOk ?? null,
      observacionOk: input.observacionOk ?? null,
      idEstimuloError: input.idEstimuloError ?? null,
      observacionError: input.observacionError ?? null,
    })
    .where(eq(mensajeriaPlantillas.id, id));

  return { data: true };
}

/** Códigos ##CODIGO## que usa la plantilla (asunto + HTML del archivo modelo), sin resolverlos — para el modal de "Probar". */
export async function extraerPlaceholdersDePlantilla(id: string): Promise<Resultado<string[]>> {
  const plantilla = await getMensajeriaPlantillaPorId(id);
  if (!plantilla) return { error: "No existe la plantilla." };
  if (!plantilla.idArchivoAdjunto) return { data: extraerCodigosPlaceholders(plantilla.asunto) };

  const archivo = await leerArchivoCrudo(plantilla.idArchivoAdjunto);
  if (archivo.error || !archivo.data) return { error: archivo.error ?? "No se pudo leer el HTML de la plantilla." };

  return { data: extraerCodigosPlaceholders(plantilla.asunto, archivo.data.buffer.toString("utf-8")) };
}

/** Borra la plantilla y su archivo asociado (si tiene uno cargado). */
export async function borrarMensajeriaPlantilla(id: string): Promise<Resultado<true>> {
  const plantilla = await getMensajeriaPlantillaPorId(id);
  if (!plantilla) return { error: "No existe la plantilla." };

  await db.delete(mensajeriaPlantillas).where(eq(mensajeriaPlantillas.id, id));
  if (plantilla.idArchivoAdjunto) await borrarArchivo(plantilla.idArchivoAdjunto);

  return { data: true };
}
