"use server";

import { revalidatePath } from "next/cache";
import { createFiltro, updateFiltro, deleteFiltro, getPermisoParaOperacion, OPERACION_ACCESO, type FiltroInput } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "filtros";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createFiltroAction(data: FiltroInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createFiltro(data);
  if (result.data) revalidatePath("/dashboard/filtros");
  return result;
}

export async function updateFiltroAction(id: string, data: FiltroInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateFiltro(id, data);
  if (result.data) revalidatePath("/dashboard/filtros");
  return result;
}

export async function deleteFiltroAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteFiltro(id);
  if (result.data) revalidatePath("/dashboard/filtros");
  return result;
}
