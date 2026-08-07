"use server";

import { getDetalleEjecucionImportador, getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "reportes";

/** Solo lectura — nivel 2 del reporte de auditoría de Importaciones (ver resultados-formato.tsx, tipo:"detalle_importacion"). */
export async function getDetalleEjecucionImportadorAction(idEjecucion: string, pagina: number) {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };

  return getDetalleEjecucionImportador(idEjecucion, pagina);
}
