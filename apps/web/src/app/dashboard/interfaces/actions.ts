"use server";

import { revalidatePath } from "next/cache";
import {
  createInterfaz,
  updateInterfaz,
  deleteInterfaz,
  getMenuesConEstado,
  toggleInterfazMenu,
  getPermisoParaHerramienta,
  type InterfazInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "interfaces";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const permiso = await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO);
  if (!permiso?.gestionar) return { error: NO_GESTIONAR };

  return {};
}

export async function createInterfazAction(data: InterfazInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createInterfaz(data);
  if (result.data) revalidatePath("/dashboard/interfaces");
  return result;
}

export async function updateInterfazAction(id: string, data: InterfazInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateInterfaz(id, data);
  if (result.data) revalidatePath("/dashboard/interfaces");
  return result;
}

export async function deleteInterfazAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteInterfaz(id);
  if (result.data) revalidatePath("/dashboard/interfaces");
  return result;
}

export async function getMenuesConEstadoAction(interfazId: string) {
  return getMenuesConEstado(interfazId);
}

export async function toggleInterfazMenuAction(interfazId: string, menuId: string, activo: boolean) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await toggleInterfazMenu(interfazId, menuId, activo);
  if (result.data) revalidatePath("/dashboard/interfaces");
  return result;
}
