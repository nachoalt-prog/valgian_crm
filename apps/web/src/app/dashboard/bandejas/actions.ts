"use server";

import { getBandejaConfig, buscarBandeja, getPermisoParaHerramienta, type BandejaConfig } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "bandejas";

async function requireAcceso(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const permiso = await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO);
  if (!permiso) return { error: "No tenés acceso a esta herramienta." };

  return {};
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
