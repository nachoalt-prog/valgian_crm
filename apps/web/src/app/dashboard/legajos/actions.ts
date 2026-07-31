"use server";

import { getLegajoDetalle, updateLegajoNumero, getEntidadPorCodigo, getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "LEGAJO_DAT_1";

async function requireAcceso(): Promise<{ error?: string; perfilId?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };

  return { perfilId: session.perfil.id, usuarioId: session.usuario.id };
}

export async function getLegajoDetalleAction(id: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };

  const data = await getLegajoDetalle(id);
  return { data };
}

export async function updateLegajoNumeroAction(id: string, numero: string) {
  const check = await requireAcceso();
  if (check.error || !check.usuarioId) return { error: check.error ?? "No autenticado." };

  return updateLegajoNumero(id, numero, check.usuarioId);
}

/** ID de ENTIDADES para "legajos" — lo usan las herramientas genéricas del motor de estados. */
export async function getEntidadLegajoAction() {
  const entidad = await getEntidadPorCodigo("legajos");
  return { data: entidad?.id ?? null };
}
