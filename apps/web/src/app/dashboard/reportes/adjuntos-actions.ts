"use server";

import { listMensajeriaColaAdjuntos, getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "reportes";

/** Solo lectura — usado por el botón "adjuntos" del reporte de Mensajería (ver resultados-formato.tsx, tipo:"adjuntos"). */
export async function listMensajeriaColaAdjuntosAction(idMensajeriaCola: string) {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };

  return { data: await listMensajeriaColaAdjuntos(idMensajeriaCola) };
}
