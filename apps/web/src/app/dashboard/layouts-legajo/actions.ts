"use server";

import { revalidatePath } from "next/cache";
import {
  createLayoutLegajo,
  updateLayoutLegajo,
  deleteLayoutLegajo,
  listLayoutSolapas,
  createLayoutSolapa,
  updateLayoutSolapa,
  deleteLayoutSolapa,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type LayoutLegajoInput,
  type SolapaInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "layouts_legajo";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createLayoutLegajoAction(data: LayoutLegajoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createLayoutLegajo(data);
  if (result.data) revalidatePath("/dashboard/layouts-legajo");
  return result;
}

export async function updateLayoutLegajoAction(id: string, data: LayoutLegajoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateLayoutLegajo(id, data);
  if (result.data) revalidatePath("/dashboard/layouts-legajo");
  return result;
}

export async function deleteLayoutLegajoAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteLayoutLegajo(id);
  if (result.data) revalidatePath("/dashboard/layouts-legajo");
  return result;
}

export async function listLayoutSolapasAction(idLayout: string) {
  return listLayoutSolapas(idLayout);
}

export async function createLayoutSolapaAction(data: SolapaInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createLayoutSolapa(data);
  if (result.data) revalidatePath("/dashboard/layouts-legajo");
  return result;
}

export async function updateLayoutSolapaAction(id: string, data: SolapaInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateLayoutSolapa(id, data);
  if (result.data) revalidatePath("/dashboard/layouts-legajo");
  return result;
}

export async function deleteLayoutSolapaAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteLayoutSolapa(id);
  if (result.data) revalidatePath("/dashboard/layouts-legajo");
  return result;
}
