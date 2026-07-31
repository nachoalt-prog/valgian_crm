import { eq } from "drizzle-orm";
import { db, plantillasAdjunto } from "@valgian/db";
import { guardarArchivo, borrarArchivo, leerArchivoCrudo } from "./archivos-adjuntos";

interface Resultado<T> {
  data?: T;
  error?: string;
}

export interface PlantillaAdjuntoDetalle {
  id: string;
  idArchivoAdjunto: string | null;
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

export async function getPlantillaAdjuntoPorCodigo(codigo: string): Promise<PlantillaAdjuntoDetalle | null> {
  const [fila] = await db.select().from(plantillasAdjunto).where(eq(plantillasAdjunto.codigo, codigo));
  return fila ?? null;
}

export async function getPlantillaAdjuntoPorId(id: string): Promise<PlantillaAdjuntoDetalle | null> {
  const [fila] = await db.select().from(plantillasAdjunto).where(eq(plantillasAdjunto.id, id));
  return fila ?? null;
}

export async function listPlantillasAdjunto(): Promise<PlantillaAdjuntoDetalle[]> {
  return db.select().from(plantillasAdjunto);
}

export interface CrearPlantillaAdjuntoInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  buffer: Buffer;
  nombreOriginal: string;
  mimetype: string;
  idUsuario: string;
}

/** Alta de una plantilla — el ARCHIVOS_ADJUNTOS resultante queda con ID_ENTIDAD/ID_REGISTRO en NULL (es global, se identifica por CODIGO). */
export async function crearPlantillaAdjunto(input: CrearPlantillaAdjuntoInput): Promise<Resultado<{ id: string }>> {
  const existente = await getPlantillaAdjuntoPorCodigo(input.codigo);
  if (existente) return { error: `Ya existe una plantilla con el código "${input.codigo}".` };

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
    .insert(plantillasAdjunto)
    .values({
      idArchivoAdjunto: archivo.data.id,
      codigo: input.codigo,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
    })
    .returning();

  return { data: { id: fila.id } };
}

export interface ActualizarPlantillaAdjuntoInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
}

/** Edita solo la metadata (código/nombre/descripción) — el archivo se reemplaza vía el modal de adjuntos (PUT /api/archivos-adjuntos/:id), no acá. */
export async function actualizarPlantillaAdjunto(id: string, input: ActualizarPlantillaAdjuntoInput): Promise<Resultado<true>> {
  const existente = await getPlantillaAdjuntoPorCodigo(input.codigo);
  if (existente && existente.id !== id) return { error: `Ya existe una plantilla con el código "${input.codigo}".` };

  await db
    .update(plantillasAdjunto)
    .set({ codigo: input.codigo, nombre: input.nombre, descripcion: input.descripcion ?? null })
    .where(eq(plantillasAdjunto.id, id));

  return { data: true };
}

/** Borra la plantilla y su archivo asociado (si tiene uno cargado). */
export async function borrarPlantillaAdjunto(id: string): Promise<Resultado<true>> {
  const plantilla = await getPlantillaAdjuntoPorId(id);
  if (!plantilla) return { error: "No existe la plantilla." };

  await db.delete(plantillasAdjunto).where(eq(plantillasAdjunto.id, id));
  if (plantilla.idArchivoAdjunto) await borrarArchivo(plantilla.idArchivoAdjunto);

  return { data: true };
}

/** El HTML crudo de la plantilla, listo para pasarle a resolverPlaceholders. */
export async function leerHtmlDeLaPlantilla(codigoPlantilla: string): Promise<Resultado<string>> {
  const plantilla = await getPlantillaAdjuntoPorCodigo(codigoPlantilla);
  if (!plantilla || !plantilla.idArchivoAdjunto) return { error: `No existe la plantilla "${codigoPlantilla}".` };

  const archivo = await leerArchivoCrudo(plantilla.idArchivoAdjunto);
  if (archivo.error || !archivo.data) return { error: archivo.error ?? "Error leyendo el archivo de la plantilla." };

  return { data: archivo.data.buffer.toString("utf-8") };
}
