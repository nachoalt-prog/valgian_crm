"use server";

import { revalidatePath } from "next/cache";
import {
  createPerfil,
  updatePerfil,
  deletePerfil,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getPermisoParaHerramienta,
  type PerfilInput,
  type UsuarioInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "usuarios_perfiles";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const permiso = await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO);
  if (!permiso?.gestionar) return { error: NO_GESTIONAR };

  return {};
}

export async function createPerfilAction(data: PerfilInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createPerfil(data);
  if (result.data) revalidatePath("/dashboard/usuarios");
  return result;
}

export async function updatePerfilAction(id: string, data: PerfilInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updatePerfil(id, data);
  if (result.data) revalidatePath("/dashboard/usuarios");
  return result;
}

export async function deletePerfilAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deletePerfil(id);
  if (result.data) revalidatePath("/dashboard/usuarios");
  return result;
}

export async function createUsuarioAction(data: UsuarioInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createUsuario(data);
  if (result.data) revalidatePath("/dashboard/usuarios");
  return result;
}

export async function updateUsuarioAction(id: string, data: UsuarioInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateUsuario(id, data);
  if (result.data) revalidatePath("/dashboard/usuarios");
  return result;
}

export async function deleteUsuarioAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteUsuario(id);
  if (result.data) revalidatePath("/dashboard/usuarios");
  return result;
}
