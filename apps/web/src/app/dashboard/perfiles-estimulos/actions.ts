"use server";

import { revalidatePath } from "next/cache";
import { createPerfilEstimulo, deletePerfilEstimulo, getPermisoParaOperacion, OPERACION_ACCESO, type PerfilEstimuloInput } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "perfiles_estimulos";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createPerfilEstimuloAction(data: PerfilEstimuloInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createPerfilEstimulo(data);
  if (result.data) revalidatePath("/dashboard/perfiles-estimulos");
  return result;
}

export async function deletePerfilEstimuloAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deletePerfilEstimulo(id);
  if (result.data) revalidatePath("/dashboard/perfiles-estimulos");
  return result;
}
