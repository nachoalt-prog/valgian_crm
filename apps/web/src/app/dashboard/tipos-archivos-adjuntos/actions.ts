"use server";

import { revalidatePath } from "next/cache";
import {
  createTipoArchivoAdjunto,
  updateTipoArchivoAdjunto,
  deleteTipoArchivoAdjunto,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type TipoArchivoAdjuntoInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "tipos_archivos_adjuntos";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createTipoArchivoAdjuntoAction(data: TipoArchivoAdjuntoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createTipoArchivoAdjunto(data);
  if (result.data) revalidatePath("/dashboard/tipos-archivos-adjuntos");
  return result;
}

export async function updateTipoArchivoAdjuntoAction(id: string, data: TipoArchivoAdjuntoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateTipoArchivoAdjunto(id, data);
  if (result.data) revalidatePath("/dashboard/tipos-archivos-adjuntos");
  return result;
}

export async function deleteTipoArchivoAdjuntoAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteTipoArchivoAdjunto(id);
  if (result.data) revalidatePath("/dashboard/tipos-archivos-adjuntos");
  return result;
}
