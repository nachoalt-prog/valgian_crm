"use server";

import { getEstimulosDisponibles, aplicarEstimulo, getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "GESTION_ENTIDAD_1";

async function requireAcceso(): Promise<{ error?: string; perfilId?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };

  return { perfilId: session.perfil.id, usuarioId: session.usuario.id };
}

export async function getEstimulosDisponiblesAction(idEntidad: string, idRelacion: string) {
  const check = await requireAcceso();
  if (check.error || !check.perfilId) return { error: check.error ?? "No autenticado." };

  const data = await getEstimulosDisponibles(idEntidad, idRelacion, check.perfilId);
  return { data };
}

export async function aplicarEstimuloAction(idEntidad: string, idRelacion: string, idEstimulo: string, observacion: string) {
  const check = await requireAcceso();
  if (check.error || !check.usuarioId) return { error: check.error ?? "No autenticado." };

  return aplicarEstimulo(idEntidad, idRelacion, idEstimulo, check.usuarioId, observacion || null);
}
