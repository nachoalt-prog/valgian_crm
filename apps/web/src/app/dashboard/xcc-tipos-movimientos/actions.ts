"use server";

import { revalidatePath } from "next/cache";
import {
  createTipoMovimiento,
  updateTipoMovimiento,
  deleteTipoMovimiento,
  type TipoMovimientoCreateInput,
  type TipoMovimientoUpdateInput,
} from "@valgian/module-cuenta-corriente";
import { getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "xcc_tipos_movimientos";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createTipoMovimientoAction(data: TipoMovimientoCreateInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createTipoMovimiento(data);
  if (result.data) revalidatePath("/dashboard/xcc-tipos-movimientos");
  return result;
}

export async function updateTipoMovimientoAction(id: string, data: TipoMovimientoUpdateInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateTipoMovimiento(id, data);
  if (result.data) revalidatePath("/dashboard/xcc-tipos-movimientos");
  return result;
}

export async function deleteTipoMovimientoAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteTipoMovimiento(id);
  if (result.data) revalidatePath("/dashboard/xcc-tipos-movimientos");
  return result;
}
