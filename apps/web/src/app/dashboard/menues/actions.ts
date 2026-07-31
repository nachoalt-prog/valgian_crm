"use server";

import { revalidatePath } from "next/cache";
import {
  createMenu,
  updateMenu,
  deleteMenu,
  createMenuOpcion,
  updateMenuOpcion,
  deleteMenuOpcion,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type MenuInput,
  type MenuOpcionInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "menues";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createMenuAction(data: MenuInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createMenu(data);
  if (result.data) revalidatePath("/dashboard/menues");
  return result;
}

export async function updateMenuAction(id: string, data: MenuInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateMenu(id, data);
  if (result.data) revalidatePath("/dashboard/menues");
  return result;
}

export async function deleteMenuAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteMenu(id);
  if (result.data) revalidatePath("/dashboard/menues");
  return result;
}

export async function createMenuOpcionAction(data: MenuOpcionInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createMenuOpcion(data);
  if (result.data) revalidatePath("/dashboard/menues");
  return result;
}

export async function updateMenuOpcionAction(id: string, data: MenuOpcionInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateMenuOpcion(id, data);
  if (result.data) revalidatePath("/dashboard/menues");
  return result;
}

export async function deleteMenuOpcionAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteMenuOpcion(id);
  if (result.data) revalidatePath("/dashboard/menues");
  return result;
}
