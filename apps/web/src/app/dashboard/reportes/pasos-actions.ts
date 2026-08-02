"use server";

import { listPasosDeEjecucion, getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "reportes";

/** Solo lectura — usado por el botón "pasos" del reporte de Procesos (ver resultados-formato.tsx, tipo:"pasos"). */
export async function listPasosDeEjecucionAction(idEjecucion: string) {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };

  return { data: await listPasosDeEjecucion(idEjecucion) };
}
