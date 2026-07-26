"use server";

import { listHistorial, getPermisoParaHerramienta } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "HISTORIAL_1";

export async function listHistorialAction(idEntidad: string, idRelacion: string) {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const permiso = await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO);
  if (!permiso) return { error: "No tenés acceso a esta herramienta." };

  const data = await listHistorial(idEntidad, idRelacion);
  return { data };
}
