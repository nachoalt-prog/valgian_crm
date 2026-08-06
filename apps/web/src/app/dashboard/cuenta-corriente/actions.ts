"use server";

import { getResumenConsolidadoLegajo, listMovimientosXcc, listAsientosXcc } from "@valgian/module-cuenta-corriente";
import { getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "XCC_RESUMEN_1";

async function checkAcceso() {
  const session = await getCurrentSession();
  if (!session?.perfil) return "No autenticado.";

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return "No tenés acceso a esta herramienta.";

  return null;
}

export async function getResumenConsolidadoLegajoAction(idLegajo: string) {
  const error = await checkAcceso();
  if (error) return { error };

  const data = await getResumenConsolidadoLegajo(idLegajo);
  return { data };
}

export async function listMovimientosXccAction(idCuenta: string, desde: string | undefined, hasta: string | undefined, pagina: number) {
  const error = await checkAcceso();
  if (error) return { error };

  const data = await listMovimientosXcc(idCuenta, { desde, hasta, pagina });
  return { data };
}

export async function listAsientosXccAction(idCuenta: string, desde: string | undefined, hasta: string | undefined, pagina: number) {
  const error = await checkAcceso();
  if (error) return { error };

  const data = await listAsientosXcc(idCuenta, { desde, hasta, pagina });
  return { data };
}
