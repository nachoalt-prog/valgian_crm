"use server";

import { getBandejaConfig, buscarBandeja, getLayoutParaBandeja, getPermisoParaOperacion, OPERACION_ACCESO, type BandejaConfig, type LayoutLegajo } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "bandejas";

async function requireAcceso(): Promise<{ error?: string; perfilId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };

  return { perfilId: session.perfil.id };
}

export async function getBandejaConfigAction(bandejaId: string): Promise<{ data?: BandejaConfig; error?: string }> {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };

  const data = await getBandejaConfig(bandejaId);
  return { data };
}

export async function buscarBandejaAction(
  bandejaId: string,
  valores: Record<string, string>,
): Promise<{ data?: Record<string, unknown>[]; error?: string }> {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };

  const data = await buscarBandeja(bandejaId, valores);
  return { data };
}

export async function getLayoutParaBandejaAction(bandejaId: string): Promise<{ data?: LayoutLegajo | null; error?: string }> {
  const check = await requireAcceso();
  if (check.error || !check.perfilId) return { error: check.error ?? "No autenticado." };

  const data = await getLayoutParaBandeja(bandejaId, check.perfilId);
  return { data };
}
