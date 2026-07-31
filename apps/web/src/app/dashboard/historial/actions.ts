"use server";

import { listHistorial, getEntidadPorCodigo, getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "HISTORIAL_1";

export async function listHistorialAction(idEntidad: string, idRelacion: string) {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };

  const data = await listHistorial(idEntidad, idRelacion);
  return { data };
}

/** ID de ENTIDADES para "historial" — lo necesita el botón "Adjuntos" de cada fila para abrir ArchivosAdjuntosTool con la entidad correcta. */
export async function getEntidadHistorialIdAction() {
  const entidad = await getEntidadPorCodigo("historial");
  return { data: entidad?.id ?? null };
}
