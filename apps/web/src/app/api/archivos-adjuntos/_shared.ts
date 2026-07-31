import { getEntidadPorCodigo, getPermisoParaHerramienta } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

type AutorizacionOk = { usuarioId: string };
type AutorizacionError = { error: string; status: number };

/**
 * Un usuario siempre puede tocar su propio avatar (ID_ENTIDAD='usuarios',
 * ID_REGISTRO=su propio ID) sin necesitar permiso de ninguna herramienta —
 * es una acción sobre su propia identidad, no una herramienta administrada.
 * Para cualquier otra entidad, hace falta indicar de qué herramienta se
 * trata y tener GESTIONAR sobre ella.
 */
export async function autorizarOperacionArchivo(params: {
  // NULL para archivos globales sin registro dueño (ej. PLANTILLAS_ADJUNTOS) — siempre exigen herramientaCodigo, nunca son "mi propio avatar".
  idEntidad: string | null;
  idRegistro: string | null;
  herramientaCodigo?: string | null;
}): Promise<AutorizacionOk | AutorizacionError> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado.", status: 401 };

  const entidadUsuarios = await getEntidadPorCodigo("usuarios");
  const esPropioAvatar = entidadUsuarios?.id === params.idEntidad && params.idRegistro === session.usuario.id;
  if (esPropioAvatar) return { usuarioId: session.usuario.id };

  if (!params.herramientaCodigo) return { error: "Falta indicar la herramienta.", status: 400 };
  const permiso = await getPermisoParaHerramienta(session.perfil.id, params.herramientaCodigo);
  if (!permiso?.gestionar) return { error: "No tenés permiso de gestión sobre esta herramienta.", status: 403 };

  return { usuarioId: session.usuario.id };
}
