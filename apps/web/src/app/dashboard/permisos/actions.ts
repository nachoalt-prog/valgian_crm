"use server";

import { revalidatePath } from "next/cache";
import {
  createPermiso,
  updatePermiso,
  deletePermiso,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type PermisoInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "permisos";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string; perfilId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return { perfilId: session.perfil.id };
}

export async function createPermisoAction(data: PermisoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createPermiso(data);
  if (result.data) revalidatePath("/dashboard/permisos");
  return result;
}

export async function updatePermisoAction(id: string, idOperacion: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updatePermiso(id, idOperacion);
  if (result.data) revalidatePath("/dashboard/permisos");
  return result;
}

export async function deletePermisoAction(id: string) {
  const check = await requireGestion();
  if (check.error || !check.perfilId) return { error: check.error ?? "No autenticado." };

  const result = await deletePermiso(id, check.perfilId);
  if (result.data) revalidatePath("/dashboard/permisos");
  return result;
}
