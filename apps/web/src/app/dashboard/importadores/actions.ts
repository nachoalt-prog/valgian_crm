"use server";

import { revalidatePath } from "next/cache";
import {
  createImportador,
  updateImportador,
  deleteImportador,
  dispararImportadorAutomatico,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type ImportadorInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "importadores";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return { usuarioId: session.usuario.id };
}

export async function createImportadorAction(data: ImportadorInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createImportador(data);
  if (result.data) revalidatePath("/dashboard/importadores");
  return result;
}

export async function updateImportadorAction(id: string, data: ImportadorInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateImportador(id, data);
  if (result.data) revalidatePath("/dashboard/importadores");
  return result;
}

export async function deleteImportadorAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteImportador(id);
  if (result.data) revalidatePath("/dashboard/importadores");
  return result;
}

/** "Correr ahora (buscar archivo)" — modo automático disparado a mano desde el ABM, usuario logueado (no "sistema", que es solo para PROCESOS sin humano). */
export async function dispararImportadorAutomaticoAction(id: string) {
  const check = await requireGestion();
  if (check.error || !check.usuarioId) return { error: check.error ?? "No autenticado." };

  const result = await dispararImportadorAutomatico(id, check.usuarioId);
  if (result.data) revalidatePath("/dashboard/importadores");
  return result;
}
