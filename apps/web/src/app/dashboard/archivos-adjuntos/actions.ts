"use server";

import { listArchivosAdjuntos, getArchivoAdjunto, getPermisoParaHerramienta } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { HERRAMIENTA_ADJUNTOS_CODIGO } from "@/lib/archivos-adjuntos-const";

async function requireAcceso() {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." } as const;
  const permiso = await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_ADJUNTOS_CODIGO);
  if (!permiso) return { error: "No tenés acceso a esta herramienta." } as const;
  return { permiso } as const;
}

export async function listArchivosAdjuntosAction(idEntidad: string, idRegistro: string) {
  const check = await requireAcceso();
  if ("error" in check) return { error: check.error };
  return { data: await listArchivosAdjuntos(idEntidad, idRegistro) };
}

export async function getArchivoAdjuntoAction(id: string) {
  const check = await requireAcceso();
  if ("error" in check) return { error: check.error };
  return { data: await getArchivoAdjunto(id) };
}
