"use server";

import { revalidatePath } from "next/cache";
import {
  createAccionExterna,
  updateAccionExterna,
  deleteAccionExterna,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type AccionExternaInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "acciones_externas";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createAccionExternaAction(data: AccionExternaInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createAccionExterna(data);
  if (result.data) revalidatePath("/dashboard/acciones-externas");
  return result;
}

export async function updateAccionExternaAction(id: string, data: AccionExternaInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateAccionExterna(id, data);
  if (result.data) revalidatePath("/dashboard/acciones-externas");
  return result;
}

export async function deleteAccionExternaAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteAccionExterna(id);
  if (result.data) revalidatePath("/dashboard/acciones-externas");
  return result;
}
