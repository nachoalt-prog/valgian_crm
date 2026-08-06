"use server";

import { revalidatePath } from "next/cache";
import {
  createCondicionImpositiva,
  updateCondicionImpositiva,
  deleteCondicionImpositiva,
  listAlicuotasPorCondicion,
  setAlicuotaCondicionRetencion,
  type CondicionImpositivaInput,
} from "@valgian/module-cuenta-corriente";
import { getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "xcc_condiciones_impositivas";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createCondicionImpositivaAction(data: CondicionImpositivaInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createCondicionImpositiva(data);
  if (result.data) revalidatePath("/dashboard/xcc-condiciones-impositivas");
  return result;
}

export async function updateCondicionImpositivaAction(id: string, data: CondicionImpositivaInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateCondicionImpositiva(id, data);
  if (result.data) revalidatePath("/dashboard/xcc-condiciones-impositivas");
  return result;
}

export async function deleteCondicionImpositivaAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteCondicionImpositiva(id);
  if (result.data) revalidatePath("/dashboard/xcc-condiciones-impositivas");
  return result;
}

export async function listAlicuotasPorCondicionAction(idCondicion: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const data = await listAlicuotasPorCondicion(idCondicion);
  return { data };
}

export async function setAlicuotaCondicionRetencionAction(idCondicion: string, idTipoRetencion: string, alicuota: number | null) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  await setAlicuotaCondicionRetencion(idCondicion, idTipoRetencion, alicuota);
  return { data: true };
}
