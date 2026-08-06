"use server";

import { revalidatePath } from "next/cache";
import { createTipoRetencion, updateTipoRetencion, deleteTipoRetencion, type TipoRetencionInput } from "@valgian/module-cuenta-corriente";
import { getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "xcc_tipos_retencion";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createTipoRetencionAction(data: TipoRetencionInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createTipoRetencion(data);
  if (result.data) revalidatePath("/dashboard/xcc-tipos-retencion");
  return result;
}

export async function updateTipoRetencionAction(id: string, data: TipoRetencionInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateTipoRetencion(id, data);
  if (result.data) revalidatePath("/dashboard/xcc-tipos-retencion");
  return result;
}

export async function deleteTipoRetencionAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteTipoRetencion(id);
  if (result.data) revalidatePath("/dashboard/xcc-tipos-retencion");
  return result;
}
