"use server";

import { revalidatePath } from "next/cache";
import {
  createBandeja,
  updateBandeja,
  deleteBandeja,
  listBandejaFiltros,
  createBandejaFiltro,
  updateBandejaFiltro,
  deleteBandejaFiltro,
  getPerfilesConEstado,
  toggleBandejaPerfil,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type BandejaInput,
  type BandejaFiltroInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "bandejas_admin";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createBandejaAction(data: BandejaInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createBandeja(data);
  if (result.data) revalidatePath("/dashboard/bandejas-admin");
  return result;
}

export async function updateBandejaAction(id: string, data: BandejaInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateBandeja(id, data);
  if (result.data) revalidatePath("/dashboard/bandejas-admin");
  return result;
}

export async function deleteBandejaAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteBandeja(id);
  if (result.data) revalidatePath("/dashboard/bandejas-admin");
  return result;
}

export async function listBandejaFiltrosAction(bandejaId: string) {
  return listBandejaFiltros(bandejaId);
}

export async function createBandejaFiltroAction(data: BandejaFiltroInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createBandejaFiltro(data);
  if (result.data) revalidatePath("/dashboard/bandejas-admin");
  return result;
}

export async function updateBandejaFiltroAction(id: string, data: { idFiltro: string; campo: string; orden: number }) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateBandejaFiltro(id, data);
  if (result.data) revalidatePath("/dashboard/bandejas-admin");
  return result;
}

export async function deleteBandejaFiltroAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteBandejaFiltro(id);
  if (result.data) revalidatePath("/dashboard/bandejas-admin");
  return result;
}

export async function getPerfilesConEstadoAction(bandejaId: string) {
  return getPerfilesConEstado(bandejaId);
}

export async function toggleBandejaPerfilAction(bandejaId: string, perfilId: string, activo: boolean) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await toggleBandejaPerfil(bandejaId, perfilId, activo);
  if (result.data) revalidatePath("/dashboard/bandejas-admin");
  return result;
}
