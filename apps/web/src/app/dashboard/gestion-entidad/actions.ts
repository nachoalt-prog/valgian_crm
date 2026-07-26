"use server";

import { getEstimulosDisponibles, aplicarEstimulo, getPermisoParaHerramienta } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "GESTION_ENTIDAD_1";

async function requireAcceso(): Promise<{ error?: string; perfilId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const permiso = await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO);
  if (!permiso) return { error: "No tenés acceso a esta herramienta." };

  return { perfilId: session.perfil.id };
}

async function requireGestion(): Promise<{ error?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const permiso = await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO);
  if (!permiso?.gestionar) return { error: "No tenés permiso de gestión sobre esta herramienta." };

  return { usuarioId: session.usuario.id };
}

export async function getEstimulosDisponiblesAction(idEntidad: string, idRelacion: string) {
  const check = await requireAcceso();
  if (check.error || !check.perfilId) return { error: check.error ?? "No autenticado." };

  const data = await getEstimulosDisponibles(idEntidad, idRelacion, check.perfilId);
  return { data };
}

export async function aplicarEstimuloAction(idEntidad: string, idRelacion: string, idEstimulo: string, observacion: string) {
  const check = await requireGestion();
  if (check.error || !check.usuarioId) return { error: check.error ?? "No autenticado." };

  return aplicarEstimulo(idEntidad, idRelacion, idEstimulo, check.usuarioId, observacion || null);
}
