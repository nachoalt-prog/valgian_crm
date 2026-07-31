import {
  getEntidadPorCodigo,
  getPermisoParaOperacion,
  tieneAsociacion,
  OPERACION_ACCESO,
  OPERACION_ADJUNTOS_CREAR,
  OPERACION_ADJUNTOS_REEMPLAZAR,
  OPERACION_ADJUNTOS_DESCARGAR,
  OPERACION_ADJUNTOS_BORRAR,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { HERRAMIENTA_ADJUNTOS_CODIGO } from "@/lib/archivos-adjuntos-const";

type AutorizacionOk = { usuarioId: string };
type AutorizacionError = { error: string; status: number };

/** "acceso" para lo que no es una acción granular (ej. preview inline) — mapea siempre a OPERACION_ACCESO. */
export type AccionArchivo = "acceso" | "crear" | "reemplazar" | "descargar" | "borrar";

const OPERACION_POR_ACCION: Partial<Record<AccionArchivo, string>> = {
  crear: OPERACION_ADJUNTOS_CREAR,
  reemplazar: OPERACION_ADJUNTOS_REEMPLAZAR,
  descargar: OPERACION_ADJUNTOS_DESCARGAR,
  borrar: OPERACION_ADJUNTOS_BORRAR,
};

/**
 * Un usuario siempre puede tocar su propio avatar sin necesitar permiso de
 * ninguna herramienta — es una acción sobre su propia identidad, no una
 * herramienta administrada. Con ARCHIVOS_ADJUNTOS_ENTIDADES (N:M), "es mi
 * propio avatar" pasa a ser "¿este archivo tiene una asociación puntual
 * contra (entidad='usuarios', registro=mi ID)?" en vez de leer un par de
 * columnas fijo del archivo — un archivo puede tener otras asociaciones
 * además de esa y sigue siendo igual de válido el bypass. Para cualquier
 * otro caso, hace falta indicar de qué herramienta se trata y tener el
 * permiso correspondiente a `accion`.
 *
 * Solo LEGAJO_ADJ_1 (Archivos Adjuntos) tiene operaciones granulares hoy —
 * primer uso real de OPERACIONES más allá de "Acceso" (ver
 * domain/infraestructura.md). Cualquier otra herramienta que reutilice este
 * mismo endpoint (ej. plantillas_adjuntos) cae al criterio genérico de
 * OPERACION_ACCESO, de momento.
 */
export async function autorizarOperacionArchivo(params: {
  // NULL en el alta (todavía no existe el archivo) — ahí nunca aplica el bypass de avatar (esa alta pasa por actualizarAvatarAction, no por acá).
  idArchivoAdjunto: string | null;
  herramientaCodigo?: string | null;
  accion: AccionArchivo;
}): Promise<AutorizacionOk | AutorizacionError> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado.", status: 401 };

  if (params.idArchivoAdjunto) {
    const entidadUsuarios = await getEntidadPorCodigo("usuarios");
    const esPropioAvatar =
      !!entidadUsuarios && (await tieneAsociacion(params.idArchivoAdjunto, entidadUsuarios.id, session.usuario.id));
    if (esPropioAvatar) return { usuarioId: session.usuario.id };
  }

  if (!params.herramientaCodigo) return { error: "Falta indicar la herramienta.", status: 400 };

  const operacionCodigo =
    params.accion !== "acceso" && params.herramientaCodigo === HERRAMIENTA_ADJUNTOS_CODIGO
      ? OPERACION_POR_ACCION[params.accion]!
      : OPERACION_ACCESO;

  const tienePermiso = await getPermisoParaOperacion(session.perfil.id, params.herramientaCodigo, operacionCodigo);
  if (!tienePermiso) return { error: "No tenés permiso para realizar esta acción.", status: 403 };

  return { usuarioId: session.usuario.id };
}
