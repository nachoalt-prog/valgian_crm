"use server";

import { getReporteConfig, buscarReporte, getPermisoParaOperacion, OPERACION_ACCESO, type ReporteConfig, type BuscarReporteResultado } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "reportes";

async function requireAcceso(): Promise<{ error?: string; perfilId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };

  return { perfilId: session.perfil.id };
}

export async function getReporteConfigAction(reporteId: string): Promise<{ data?: ReporteConfig; error?: string }> {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };

  const data = await getReporteConfig(reporteId);
  return { data };
}

export async function buscarReporteAction(
  reporteId: string,
  valores: Record<string, string>,
  pagina: number,
): Promise<{ data?: BuscarReporteResultado; error?: string }> {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };

  const data = await buscarReporte(reporteId, valores, pagina);
  return { data };
}
