import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db, mensajeriaCola, mensajeriaColaAdjuntos, mensajeriaPlantillas, accionesExternas, archivosAdjuntos, tiposArchivosAdjuntos } from "@valgian/db";
import { resolverPlaceholders, type ResolverPlaceholdersResult } from "./placeholders";
import { leerArchivoCrudo } from "./archivos-adjuntos";
import { aplicarEstimulo } from "./motor-estados";
import { getEntidadPorCodigo } from "./entidades";
import { finalizarIntentoAccionExterna, type FilaAccionExternaCola } from "./acciones-externas";

/**
 * Mensajería — ver domain/acciones-externas.md, sección Mensajería. Contrato
 * compartido para TODOS los componentes de mensajería (SMTP, a futuro
 * SMS/WhatsApp): cada proveedor solo implementa `EnviarUnMensaje` (cómo
 * mandar UN mensaje ya resuelto); todo lo demás (modo de despacho, resolución
 * de plantilla/placeholders/adjuntos, bookkeeping de reintento, aplicación de
 * estímulos) lo resuelve `procesarComponenteMensajeria` una única vez.
 */

const ENTIDAD_MENSAJERIA_CODIGO = "mensajeria_cola";

export interface EncolarMensajeInput {
  idPlantilla: string;
  idAccionExterna: string;
  idEntidad?: string | null;
  idRegistro?: string | null;
  idsAdjuntos?: string[];
  datos: unknown;
  /** A dónde mandarlo (mail, teléfono, ...) — cada COMPONENTE lo interpreta a su manera. */
  destino?: string | null;
}

/** Ejecuta SP_MENSAJERIA_ENCOLAR — ver packages/db/sql/0009_sp_mensajeria_encolar_destino.sql. */
export async function encolarMensaje(input: EncolarMensajeInput): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const idsAdjuntos = input.idsAdjuntos ?? [];
  // postgres.js serializa un array JS pasado suelto como parámetro como una
  // fila (record), no como array literal — se arma el ARRAY[...] explícito
  // con cada elemento parametrizado por separado (mismo gotcha documentado
  // en tramites.ts, aplicarFiltroOrden).
  const arrayAdjuntos =
    idsAdjuntos.length > 0
      ? sql`ARRAY[${sql.join(
          idsAdjuntos.map((a) => sql`${a}::uuid`),
          sql`, `,
        )}]`
      : sql`ARRAY[]::uuid[]`;

  await db.execute(
    sql`CALL sp_mensajeria_encolar(${id}, ${input.idPlantilla}, ${input.idAccionExterna}, ${input.idEntidad ?? null}, ${input.idRegistro ?? null}, ${arrayAdjuntos}, ${JSON.stringify(input.datos)}::jsonb, ${input.destino ?? null})`,
  );
  return { id };
}

interface FilaMensajeCola {
  id: string;
  idAccionExterna: string | null;
  idMensajeriaPlantilla: string | null;
  idEntidad: string | null;
  idRegistro: string | null;
  asunto: string | null;
  destino: string | null;
  datosRaiz: unknown;
  fechaEncolado: Date | null;
  reintento: number;
}

/** Elegibles: nunca exitosos (null o != 0 — el OR isNull es necesario, NULL != 0 da UNKNOWN en SQL) y no superados. */
function condicionElegible() {
  return and(or(isNull(mensajeriaCola.resultado), ne(mensajeriaCola.resultado, 0)), eq(mensajeriaCola.reintentosSuperados, false));
}

async function listMensajesElegibles(filtro: { id: string } | { idAccionExterna: string }): Promise<FilaMensajeCola[]> {
  const condicionExtra = "id" in filtro ? eq(mensajeriaCola.id, filtro.id) : eq(mensajeriaCola.idAccionExterna, filtro.idAccionExterna);

  const filas = await db
    .select({
      id: mensajeriaCola.id,
      idAccionExterna: mensajeriaCola.idAccionExterna,
      idMensajeriaPlantilla: mensajeriaCola.idMensajeriaPlantilla,
      idEntidad: mensajeriaCola.idEntidad,
      idRegistro: mensajeriaCola.idRegistro,
      asunto: mensajeriaCola.asunto,
      destino: mensajeriaCola.destino,
      datosRaiz: mensajeriaCola.datosRaiz,
      fechaEncolado: mensajeriaCola.fechaEncolado,
      reintento: mensajeriaCola.reintento,
    })
    .from(mensajeriaCola)
    .where(and(condicionElegible(), condicionExtra));

  return filas.map((f) => ({ ...f, reintento: f.reintento ?? 0 }));
}

export interface MensajeriaColaAdjuntoDetalle {
  id: string;
  nombreOriginal: string | null;
  mimetype: string | null;
}

/** Solo metadata (para listar/descargar) — a diferencia de cargarAdjuntosMensaje, que trae el contenido completo para mandarlo. */
export async function listMensajeriaColaAdjuntos(idMensajeriaCola: string): Promise<MensajeriaColaAdjuntoDetalle[]> {
  const filas = await db
    .select({
      id: mensajeriaColaAdjuntos.idArchivoAdjunto,
      nombreOriginal: archivosAdjuntos.nombreOriginal,
      mimetype: tiposArchivosAdjuntos.mimetype,
    })
    .from(mensajeriaColaAdjuntos)
    .innerJoin(archivosAdjuntos, eq(archivosAdjuntos.id, mensajeriaColaAdjuntos.idArchivoAdjunto))
    .leftJoin(tiposArchivosAdjuntos, eq(tiposArchivosAdjuntos.id, archivosAdjuntos.idTipoArchivoAdjunto))
    .where(eq(mensajeriaColaAdjuntos.idMensajeriaCola, idMensajeriaCola));

  return filas.filter((f): f is MensajeriaColaAdjuntoDetalle => !!f.id);
}

export interface AdjuntoMensaje {
  nombreOriginal: string;
  mimetype: string | null;
  buffer: Buffer;
}

async function cargarAdjuntosMensaje(idMensajeriaCola: string): Promise<AdjuntoMensaje[]> {
  const filas = await db
    .select({ idArchivoAdjunto: mensajeriaColaAdjuntos.idArchivoAdjunto })
    .from(mensajeriaColaAdjuntos)
    .where(eq(mensajeriaColaAdjuntos.idMensajeriaCola, idMensajeriaCola));

  const adjuntos: AdjuntoMensaje[] = [];
  for (const fila of filas) {
    if (!fila.idArchivoAdjunto) continue;
    const resultado = await leerArchivoCrudo(fila.idArchivoAdjunto);
    if (resultado.data) adjuntos.push(resultado.data);
  }
  return adjuntos;
}

export interface MensajeParaEnviar {
  id: string;
  asunto: string | null;
  cuerpoHtml: string;
  /** A dónde mandarlo — MENSAJERIA_COLA.DESTINO, ya resuelto por SP_MENSAJERIA_ENCOLAR. */
  destino: string | null;
  /** Datos raíz crudos, por si el proveedor necesita algo más que el destino. */
  datosRaiz: unknown;
  adjuntos: AdjuntoMensaje[];
}

export interface ResultadoEnvioMensaje {
  exito: boolean;
  descripcion?: string | null;
}

export type EnviarUnMensaje = (mensaje: MensajeParaEnviar, parametrosAccion: unknown) => Promise<ResultadoEnvioMensaje>;

/** El componente llama esto al terminar CADA mensaje — centraliza reintento (contra la ACCIONES_EXTERNAS asociada) y aplicación de estímulos. */
async function finalizarIntentoMensaje(
  fila: FilaMensajeCola,
  resultado: { resultado: number; resultadoDesc: string | null; placeholders: Record<string, string> | null },
): Promise<void> {
  let reintentosMax: number | null = null;
  let reintentosMargen: number | null = null;
  if (fila.idAccionExterna) {
    const [accion] = await db
      .select({ reintentosMax: accionesExternas.reintentosMax, reintentosMargen: accionesExternas.reintentosMargen })
      .from(accionesExternas)
      .where(eq(accionesExternas.id, fila.idAccionExterna));
    reintentosMax = accion?.reintentosMax ?? null;
    reintentosMargen = accion?.reintentosMargen ?? null;
  }

  const nuevoReintento = fila.reintento + 1;
  const huboExito = resultado.resultado === 0;

  let superado = false;
  if (!huboExito) {
    const superoMax = reintentosMax != null && nuevoReintento >= reintentosMax;
    const superoMargen = reintentosMargen != null && fila.fechaEncolado != null && Date.now() - fila.fechaEncolado.getTime() > reintentosMargen * 60_000;
    superado = superoMax || superoMargen;
  }

  await db
    .update(mensajeriaCola)
    .set({
      resultado: resultado.resultado,
      resultadoDesc: resultado.resultadoDesc,
      resultadoFecha: new Date(),
      reintento: nuevoReintento,
      reintentosSuperados: superado,
      placeholders: resultado.placeholders,
    })
    .where(eq(mensajeriaCola.id, fila.id));

  // Estímulos: OK en el intento que tuvo éxito; ERROR recién al agotar reintentos (no en cada intento fallido individual).
  if (!fila.idEntidad || !fila.idRegistro || !fila.idMensajeriaPlantilla) return;
  const debeAplicarOk = huboExito;
  const debeAplicarError = !huboExito && superado;
  if (!debeAplicarOk && !debeAplicarError) return;

  const [plantilla] = await db
    .select({
      idEstimuloOk: mensajeriaPlantillas.idEstimuloOk,
      observacionOk: mensajeriaPlantillas.observacionOk,
      idEstimuloError: mensajeriaPlantillas.idEstimuloError,
      observacionError: mensajeriaPlantillas.observacionError,
    })
    .from(mensajeriaPlantillas)
    .where(eq(mensajeriaPlantillas.id, fila.idMensajeriaPlantilla));
  if (!plantilla) return;

  const idEstimulo = debeAplicarOk ? plantilla.idEstimuloOk : plantilla.idEstimuloError;
  const observacion = debeAplicarOk ? plantilla.observacionOk : plantilla.observacionError;
  if (!idEstimulo) return;

  // Sin usuario — es el sistema, no una persona logueada (mismo criterio que guardarArchivo en la generación de documentos).
  const aplicado = await aplicarEstimulo(fila.idEntidad, fila.idRegistro, idEstimulo, null, observacion ?? null);
  if (aplicado.error) {
    console.error(`[mensajeria] No se pudo aplicar el estímulo de ${debeAplicarOk ? "éxito" : "error"} para el mensaje ${fila.id}: ${aplicado.error}`);
  }
}

async function procesarUnMensaje(fila: FilaMensajeCola, parametrosAccion: unknown, enviarUno: EnviarUnMensaje): Promise<boolean> {
  if (!fila.idMensajeriaPlantilla) {
    await finalizarIntentoMensaje(fila, { resultado: 1, resultadoDesc: "El mensaje no tiene plantilla configurada.", placeholders: null });
    return false;
  }

  const [plantilla] = await db.select().from(mensajeriaPlantillas).where(eq(mensajeriaPlantillas.id, fila.idMensajeriaPlantilla));
  if (!plantilla?.idArchivoAdjunto) {
    await finalizarIntentoMensaje(fila, { resultado: 1, resultadoDesc: "La plantilla no tiene un archivo HTML configurado.", placeholders: null });
    return false;
  }

  const htmlCrudo = await leerArchivoCrudo(plantilla.idArchivoAdjunto);
  if (htmlCrudo.error || !htmlCrudo.data) {
    await finalizarIntentoMensaje(fila, { resultado: 1, resultadoDesc: htmlCrudo.error ?? "No se pudo leer el HTML de la plantilla.", placeholders: null });
    return false;
  }

  const cuerpoResuelto = await resolverPlaceholders(htmlCrudo.data.buffer.toString("utf-8"), fila.datosRaiz);
  if (cuerpoResuelto.error || cuerpoResuelto.html === undefined) {
    await finalizarIntentoMensaje(fila, { resultado: 1, resultadoDesc: cuerpoResuelto.error ?? "Error resolviendo el cuerpo del mensaje.", placeholders: null });
    return false;
  }

  const asuntoResuelto: ResolverPlaceholdersResult = fila.asunto
    ? await resolverPlaceholders(fila.asunto, fila.datosRaiz)
    : { html: undefined, valores: {} };
  if (asuntoResuelto.error) {
    await finalizarIntentoMensaje(fila, { resultado: 1, resultadoDesc: asuntoResuelto.error, placeholders: null });
    return false;
  }

  const placeholdersResueltos = { ...cuerpoResuelto.valores, ...asuntoResuelto.valores };
  const adjuntos = await cargarAdjuntosMensaje(fila.id);

  const mensaje: MensajeParaEnviar = {
    id: fila.id,
    asunto: asuntoResuelto.html ?? fila.asunto,
    cuerpoHtml: cuerpoResuelto.html,
    destino: fila.destino,
    datosRaiz: fila.datosRaiz,
    adjuntos,
  };

  try {
    const resultadoEnvio = await enviarUno(mensaje, parametrosAccion);
    await finalizarIntentoMensaje(fila, {
      resultado: resultadoEnvio.exito ? 0 : 1,
      resultadoDesc: resultadoEnvio.descripcion ?? null,
      placeholders: placeholdersResueltos,
    });
    return resultadoEnvio.exito;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finalizarIntentoMensaje(fila, { resultado: 1, resultadoDesc: message, placeholders: placeholdersResueltos });
    return false;
  }
}

/**
 * Punto de entrada único para CUALQUIER componente de mensajería — lo llama
 * el handler registrado en `registrarHandlerAccionExterna`. Determina el modo
 * según domain/acciones-externas.md:
 * - `ID_ENTIDAD`/`ID_REGISTRO` de la fila apuntan a un mensaje puntual (entidad
 *   `mensajeria_cola`, `ID_REGISTRO` = `MENSAJERIA_COLA.ID`): procesa SOLO ese mensaje.
 * - Si no: barre TODOS los mensajes elegibles de esta `ACCIONES_EXTERNAS`.
 */
export async function procesarComponenteMensajeria(fila: FilaAccionExternaCola, enviarUno: EnviarUnMensaje): Promise<void> {
  const entidadMensajeria = await getEntidadPorCodigo(ENTIDAD_MENSAJERIA_CODIGO);
  const esMensajeEspecifico = !!entidadMensajeria && fila.idEntidad === entidadMensajeria.id && !!fila.idRegistro;

  const mensajes = esMensajeEspecifico
    ? await listMensajesElegibles({ id: fila.idRegistro! })
    : fila.idAccionExterna
      ? await listMensajesElegibles({ idAccionExterna: fila.idAccionExterna })
      : [];

  let huboError = false;
  for (const mensaje of mensajes) {
    const exito = await procesarUnMensaje(mensaje, fila.parametrosAccion, enviarUno);
    if (!exito) huboError = true;
  }

  await finalizarIntentoAccionExterna(fila.id, {
    resultado: huboError ? 1 : 0,
    resultadoDesc: `${mensajes.length} mensaje(s) procesado(s)${huboError ? ", con al menos un error" : ""}.`,
  });
}
