"use server";

import { revalidatePath } from "next/cache";
import {
  createProceso,
  updateProceso,
  deleteProceso,
  dispararProcesoManual,
  listPasosPorProceso,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type ProcesoInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "procesos";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return { usuarioId: session.usuario.id };
}

export async function createProcesoAction(data: ProcesoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createProceso(data);
  if (result.data) revalidatePath("/dashboard/procesos");
  return result;
}

export async function updateProcesoAction(id: string, data: ProcesoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateProceso(id, data);
  if (result.data) revalidatePath("/dashboard/procesos");
  return result;
}

export async function deleteProcesoAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteProceso(id);
  if (result.data) revalidatePath("/dashboard/procesos");
  return result;
}

export async function listPasosPorProcesoAction(id: string) {
  const check = await requireGestion();
  if (check.error) return [];

  return listPasosPorProceso(id);
}

export async function dispararProcesoManualAction(id: string) {
  const check = await requireGestion();
  if (check.error || !check.usuarioId) return { error: check.error ?? "No autenticado." };

  const result = await dispararProcesoManual(id, check.usuarioId);
  if (result.data) revalidatePath("/dashboard/procesos");
  return result;
}
