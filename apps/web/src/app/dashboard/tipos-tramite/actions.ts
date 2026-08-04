"use server";

import { revalidatePath } from "next/cache";
import {
  crearTipoTramite,
  actualizarTipoTramite,
  borrarTipoTramite,
  listTiposTramiteCampos,
  crearTipoTramiteCampo,
  actualizarTipoTramiteCampo,
  borrarTipoTramiteCampo,
  listTiposCampos,
  listEstadosPorEstrategia,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type TipoTramiteInput,
  type TipoTramiteCampoInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "tipos_tramite";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function crearTipoTramiteAction(data: TipoTramiteInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await crearTipoTramite(data);
  if (result.data) revalidatePath("/dashboard/tipos-tramite");
  return result;
}

export async function actualizarTipoTramiteAction(id: string, data: TipoTramiteInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await actualizarTipoTramite(id, data);
  if (result.data) revalidatePath("/dashboard/tipos-tramite");
  return result;
}

export async function borrarTipoTramiteAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await borrarTipoTramite(id);
  if (result.data) revalidatePath("/dashboard/tipos-tramite");
  return result;
}

export async function listTiposTramiteCamposAction(idTipoTramite: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };
  return { data: await listTiposTramiteCampos(idTipoTramite) };
}

export async function crearTipoTramiteCampoAction(idTipoTramite: string, data: TipoTramiteCampoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await crearTipoTramiteCampo(idTipoTramite, data);
  if (result.data) revalidatePath("/dashboard/tipos-tramite");
  return result;
}

export async function actualizarTipoTramiteCampoAction(id: string, data: TipoTramiteCampoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await actualizarTipoTramiteCampo(id, data);
  if (result.data) revalidatePath("/dashboard/tipos-tramite");
  return result;
}

export async function borrarTipoTramiteCampoAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await borrarTipoTramiteCampo(id);
  if (result.data) revalidatePath("/dashboard/tipos-tramite");
  return result;
}

export async function listTiposCamposAction() {
  const check = await requireGestion();
  if (check.error) return { error: check.error };
  return { data: await listTiposCampos() };
}

export async function listEstadosPorEstrategiaAction(idEstrategia: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };
  return { data: await listEstadosPorEstrategia(idEstrategia) };
}
