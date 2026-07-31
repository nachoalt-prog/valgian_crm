"use server";

import { revalidatePath } from "next/cache";
import { createPlaceholder, updatePlaceholder, deletePlaceholder, getPermisoParaOperacion, OPERACION_ACCESO, type PlaceholderInput } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "placeholders";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createPlaceholderAction(data: PlaceholderInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createPlaceholder(data);
  if (result.data) revalidatePath("/dashboard/placeholders");
  return result;
}

export async function updatePlaceholderAction(id: string, data: PlaceholderInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updatePlaceholder(id, data);
  if (result.data) revalidatePath("/dashboard/placeholders");
  return result;
}

export async function deletePlaceholderAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deletePlaceholder(id);
  if (result.data) revalidatePath("/dashboard/placeholders");
  return result;
}
