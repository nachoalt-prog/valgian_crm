"use server";

import { revalidatePath } from "next/cache";
import { createMoneda, updateMoneda, deleteMoneda, getPermisoParaOperacion, OPERACION_ACCESO, type MonedaInput } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "monedas";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createMonedaAction(data: MonedaInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createMoneda(data);
  if (result.data) revalidatePath("/dashboard/monedas");
  return result;
}

export async function updateMonedaAction(id: string, data: MonedaInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateMoneda(id, data);
  if (result.data) revalidatePath("/dashboard/monedas");
  return result;
}

export async function deleteMonedaAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteMoneda(id);
  if (result.data) revalidatePath("/dashboard/monedas");
  return result;
}
