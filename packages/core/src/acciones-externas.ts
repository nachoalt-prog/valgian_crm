import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db, queryClient, accionesExternas, accionesExternasCola } from "@valgian/db";

/**
 * Capa de infraestructura de Acciones Externas — ver domain/acciones-externas.md,
 * ADR 0016. ACCIONES_EXTERNAS/ACCIONES_EXTERNAS_COLA son puramente genéricas
 * (catálogo + cola) — nunca guardan datos de dominio. Cada COMPONENTE real
 * (ej. 'consulta_cotizacion') vive en su propio módulo opcional
 * (packages/modules/<nombre>), que se registra acá vía registrarHandlerAccionExterna
 * — este archivo NUNCA importa un módulo directo (regla de dependencia,
 * docs/contracts/modulo.md).
 */

export interface EncolarAccionExternaInput {
  idAccionExterna: string;
  idEntidad?: string | null;
  idRegistro?: string | null;
  parametros?: unknown;
}

export async function encolarAccionExterna(input: EncolarAccionExternaInput): Promise<{ id: string }> {
  const [fila] = await db
    .insert(accionesExternasCola)
    .values({
      idAccionExterna: input.idAccionExterna,
      idEntidad: input.idEntidad ?? null,
      idRegistro: input.idRegistro ?? null,
      parametros: input.parametros ?? null,
    })
    .returning();
  return { id: fila.id };
}

/** Suscribe `onNotify` al canal de NOTIFY del trigger — ver 0007_trigger_notify_acciones_externas_cola.sql. */
export async function escucharAccionesExternasPendientes(onNotify: () => void): Promise<void> {
  await queryClient.listen("acciones_externas_cola", onNotify);
}

export interface FilaAccionExternaCola {
  id: string;
  idAccionExterna: string | null;
  componente: string;
  /** ACCIONES_EXTERNAS.PARAMETROS — fijo, config propia del componente (credenciales, etc.). */
  parametrosAccion: unknown;
  /** ACCIONES_EXTERNAS_COLA.PARAMETROS — dinámico, propio de esta llamada puntual. */
  parametros: unknown;
  idEntidad: string | null;
  idRegistro: string | null;
  fechaEncolado: Date | null;
  reintento: number;
}

/**
 * Filas elegibles para el barrido: nunca exitosas (`RESULTADO` null o != 0 —
 * el `OR isNull` es necesario porque en SQL `NULL != 0` da UNKNOWN, no TRUE,
 * así que una condición ingenua excluiría en silencio las filas nunca
 * intentadas), no dadas por superadas, la acción activa, y todavía dentro del
 * margen de reintento (o sin margen configurado = sin límite de tiempo).
 */
async function listAccionesExternasColaElegibles(): Promise<FilaAccionExternaCola[]> {
  const filas = await db
    .select({
      id: accionesExternasCola.id,
      idAccionExterna: accionesExternasCola.idAccionExterna,
      componente: accionesExternas.componente,
      parametrosAccion: accionesExternas.parametros,
      parametros: accionesExternasCola.parametros,
      idEntidad: accionesExternasCola.idEntidad,
      idRegistro: accionesExternasCola.idRegistro,
      fechaEncolado: accionesExternasCola.fechaEncolado,
      reintento: accionesExternasCola.reintento,
    })
    .from(accionesExternasCola)
    .innerJoin(accionesExternas, eq(accionesExternas.id, accionesExternasCola.idAccionExterna))
    .where(
      and(
        or(isNull(accionesExternasCola.resultado), ne(accionesExternasCola.resultado, 0)),
        eq(accionesExternasCola.reintentosSuperados, false),
        eq(accionesExternas.activo, true),
        sql`(${accionesExternas.reintentosMargen} IS NULL OR ${accionesExternasCola.fechaEncolado} >= now() - (${accionesExternas.reintentosMargen} || ' minutes')::interval)`,
      ),
    );

  return filas.map((f) => ({ ...f, reintento: f.reintento ?? 0 }));
}

export interface ResultadoIntentoAccionExterna {
  /** 0 = éxito, cualquier otro valor = error (el componente elige el código). */
  resultado: number;
  resultadoDesc?: string | null;
  request?: unknown;
  response?: unknown;
  tiempoConexionMs?: number;
}

/**
 * El componente llama esto al terminar (éxito o error) — centraliza acá el
 * cálculo de REINTENTO/REINTENTOS_SUPERADOS contra REINTENTOS_MAX/REINTENTOS_MARGEN
 * de ACCIONES_EXTERNAS, para que esa aritmética no se duplique en cada handler.
 */
export async function finalizarIntentoAccionExterna(idCola: string, resultado: ResultadoIntentoAccionExterna): Promise<void> {
  const [fila] = await db
    .select({
      reintento: accionesExternasCola.reintento,
      fechaEncolado: accionesExternasCola.fechaEncolado,
      reintentosMax: accionesExternas.reintentosMax,
      reintentosMargen: accionesExternas.reintentosMargen,
    })
    .from(accionesExternasCola)
    .innerJoin(accionesExternas, eq(accionesExternas.id, accionesExternasCola.idAccionExterna))
    .where(eq(accionesExternasCola.id, idCola));

  if (!fila) return;

  const nuevoReintento = (fila.reintento ?? 0) + 1;
  const huboExito = resultado.resultado === 0;

  let superado = false;
  if (!huboExito) {
    const superoMax = fila.reintentosMax != null && nuevoReintento >= fila.reintentosMax;
    const superoMargen =
      fila.reintentosMargen != null &&
      fila.fechaEncolado != null &&
      Date.now() - fila.fechaEncolado.getTime() > fila.reintentosMargen * 60_000;
    superado = superoMax || superoMargen;
  }

  await db
    .update(accionesExternasCola)
    .set({
      resultado: resultado.resultado,
      resultadoDesc: resultado.resultadoDesc ?? null,
      resultadoFecha: new Date(),
      reintento: nuevoReintento,
      reintentosSuperados: superado,
      tiempoConexion: resultado.tiempoConexionMs ?? null,
      request: resultado.request ?? null,
      response: resultado.response ?? null,
    })
    .where(eq(accionesExternasCola.id, idCola));
}

type HandlerAccionExterna = (fila: FilaAccionExternaCola) => Promise<void>;

const handlers = new Map<string, HandlerAccionExterna>();

/** Llamado por cada módulo opcional al registrarse (ver docs/contracts/modulo.md) — nunca al revés. */
export function registrarHandlerAccionExterna(componente: string, handler: HandlerAccionExterna): void {
  handlers.set(componente, handler);
}

/**
 * El barrido: trae las filas elegibles y dispara su handler EN PARALELO (no
 * secuencial). Nota de diseño: no hay un estado intermedio tipo "procesando"
 * — una fila cuyo handler tarda más de un ciclo del barrido podría, en
 * teoría, ser reclamada dos veces por dos pasadas superpuestas. Riesgo
 * aceptado en esta primera versión (el único componente de este sprint hace
 * unos pocos GET rápidos) — si en algún momento hace falta la garantía
 * fuerte, se resuelve con un lock de fila (`FOR UPDATE SKIP LOCKED`) sin
 * cambiar nada del resto de este diseño.
 */
export async function procesarAccionesExternasPendientes(): Promise<void> {
  const filas = await listAccionesExternasColaElegibles();

  await Promise.allSettled(
    filas.map(async (fila) => {
      const handler = handlers.get(fila.componente);
      if (!handler) {
        console.error(`[acciones-externas] No hay handler registrado para el componente "${fila.componente}" (fila ${fila.id}).`);
        return;
      }
      try {
        await handler(fila);
      } catch (err) {
        // Red de seguridad: si el handler tira sin haber llamado a
        // finalizarIntentoAccionExterna, no dejamos la fila colgada para siempre.
        const message = err instanceof Error ? err.message : String(err);
        await finalizarIntentoAccionExterna(fila.id, { resultado: 1, resultadoDesc: message });
      }
    }),
  );
}
