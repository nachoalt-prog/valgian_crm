"use server";

import { revalidatePath } from "next/cache";
import {
  crearCategoriaTipoTramite,
  actualizarCategoriaTipoTramite,
  borrarCategoriaTipoTramite,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type CategoriaTipoTramiteInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "categorias_tipos_tramite";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function crearCategoriaTipoTramiteAction(data: CategoriaTipoTramiteInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await crearCategoriaTipoTramite(data);
  if (result.data) revalidatePath("/dashboard/categorias-tipos-tramite");
  return result;
}

export async function actualizarCategoriaTipoTramiteAction(id: string, data: CategoriaTipoTramiteInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await actualizarCategoriaTipoTramite(id, data);
  if (result.data) revalidatePath("/dashboard/categorias-tipos-tramite");
  return result;
}

export async function borrarCategoriaTipoTramiteAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await borrarCategoriaTipoTramite(id);
  if (result.data) revalidatePath("/dashboard/categorias-tipos-tramite");
  return result;
}
