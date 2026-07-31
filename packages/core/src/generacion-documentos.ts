import { eq } from "drizzle-orm";
import { db, queryClient, generacionesDocumento } from "@valgian/db";
import { getPlantillaAdjuntoPorId } from "./plantillas-adjunto";
import { resolverPlaceholders } from "./placeholders";
import { htmlAPdf } from "./html-a-pdf";
import { guardarArchivo, leerArchivoCrudo } from "./archivos-adjuntos";

interface Resultado<T> {
  data?: T;
  error?: string;
}

export interface EncolarGeneracionInput {
  idPlantilla: string;
  idEntidad?: string | null;
  idRegistro?: string | null;
  datos: unknown;
}

/**
 * Suscribe `onNotify` al canal de NOTIFY del trigger — apps/web nunca debe
 * importar `@valgian/db` directo (queryClient incluido), así que este wrapper
 * es el único punto por el que `instrumentation.ts` puede engancharse al
 * LISTEN persistente.
 */
export async function escucharGeneracionesPendientes(onNotify: () => void): Promise<void> {
  await queryClient.listen("generaciones_documento", onNotify);
}

/** Inserta una fila 'pendiente' — el trigger de la base dispara el NOTIFY, el worker (instrumentation.ts) reacciona solo. */
export async function encolarGeneracion(input: EncolarGeneracionInput): Promise<Resultado<{ id: string }>> {
  const ahora = new Date();
  const [fila] = await db
    .insert(generacionesDocumento)
    .values({
      idPlantilla: input.idPlantilla,
      idEntidad: input.idEntidad ?? null,
      idRegistro: input.idRegistro ?? null,
      datos: input.datos,
      estado: "pendiente",
      altaFecha: ahora,
      auditFecha: ahora,
    })
    .returning();
  return { data: { id: fila.id } };
}

/**
 * Reclama UNA fila pendiente (transacción corta: SELECT FOR UPDATE SKIP
 * LOCKED + UPDATE a 'procesando', commit inmediato) — tolera múltiples
 * instancias del worker sin coordinación adicional. El trabajo pesado
 * (Playwright) pasa DESPUÉS, fuera de la transacción, para no dejarla
 * abierta más de lo necesario.
 */
async function reclamarGeneracionPendiente() {
  return db.transaction(async (tx) => {
    const [fila] = await tx
      .select()
      .from(generacionesDocumento)
      .where(eq(generacionesDocumento.estado, "pendiente"))
      .orderBy(generacionesDocumento.altaFecha)
      .limit(1)
      .for("update", { skipLocked: true });

    if (!fila) return null;

    await tx
      .update(generacionesDocumento)
      .set({ estado: "procesando", auditFecha: new Date() })
      .where(eq(generacionesDocumento.id, fila.id));

    return fila;
  });
}

async function finalizarGeneracion(id: string, resultado: { idArchivoResultado: string } | { error: string }) {
  await db
    .update(generacionesDocumento)
    .set({
      estado: "error" in resultado ? "error" : "completado",
      idArchivoResultado: "idArchivoResultado" in resultado ? resultado.idArchivoResultado : null,
      error: "error" in resultado ? resultado.error : null,
      auditFecha: new Date(),
    })
    .where(eq(generacionesDocumento.id, id));
}

/** Procesa UNA generación pendiente, si hay alguna. Se usa tanto al reaccionar al NOTIFY como en el barrido de seguridad periódico. */
export async function procesarUnaGeneracionPendiente(): Promise<{ procesada: boolean; id?: string; error?: string }> {
  const fila = await reclamarGeneracionPendiente();
  if (!fila) return { procesada: false };

  try {
    if (!fila.idPlantilla) throw new Error("La generación no tiene ID_PLANTILLA.");

    const plantilla = await getPlantillaAdjuntoPorId(fila.idPlantilla);
    if (!plantilla || !plantilla.idArchivoAdjunto) throw new Error(`No existe la plantilla ${fila.idPlantilla}.`);

    const htmlPlantilla = await leerArchivoCrudo(plantilla.idArchivoAdjunto);
    if (htmlPlantilla.error || !htmlPlantilla.data) throw new Error(htmlPlantilla.error ?? "Error leyendo la plantilla.");

    const resuelto = await resolverPlaceholders(htmlPlantilla.data.buffer.toString("utf-8"), fila.datos);
    if (resuelto.error || resuelto.html === undefined) throw new Error(resuelto.error ?? "Error resolviendo placeholders.");

    const pdf = await htmlAPdf(resuelto.html);

    const archivo = await guardarArchivo({
      idEntidad: fila.idEntidad,
      idRegistro: fila.idRegistro,
      buffer: pdf,
      nombreOriginal: `${plantilla.nombre}.pdf`,
      mimetype: "application/pdf",
      idUsuario: null,
    });
    if (archivo.error || !archivo.data) throw new Error(archivo.error ?? "Error guardando el PDF generado.");

    await finalizarGeneracion(fila.id, { idArchivoResultado: archivo.data.id });
    return { procesada: true, id: fila.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finalizarGeneracion(fila.id, { error: message });
    return { procesada: true, id: fila.id, error: message };
  }
}
