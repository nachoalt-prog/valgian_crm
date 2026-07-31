"use server";

import {
  listArchivosAdjuntos,
  getArchivoAdjunto,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  OPERACION_ADJUNTOS_CREAR,
  OPERACION_ADJUNTOS_REEMPLAZAR,
  OPERACION_ADJUNTOS_DESCARGAR,
  OPERACION_ADJUNTOS_GUARDAR,
  OPERACION_ADJUNTOS_BORRAR,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { HERRAMIENTA_ADJUNTOS_CODIGO } from "@/lib/archivos-adjuntos-const";

async function requireAcceso() {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." } as const;
  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_ADJUNTOS_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." } as const;
  return {} as const;
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

export interface PermisosGranularesAdjuntos {
  crear: boolean;
  reemplazar: boolean;
  descargar: boolean;
  guardar: boolean;
  borrar: boolean;
}

/** Primer uso real de operaciones granulares — cada botón del modal valida la suya. */
export async function getPermisosGranularesAdjuntosAction(): Promise<PermisosGranularesAdjuntos> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { crear: false, reemplazar: false, descargar: false, guardar: false, borrar: false };

  const [crear, reemplazar, descargar, guardar, borrar] = await Promise.all([
    getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_ADJUNTOS_CODIGO, OPERACION_ADJUNTOS_CREAR),
    getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_ADJUNTOS_CODIGO, OPERACION_ADJUNTOS_REEMPLAZAR),
    getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_ADJUNTOS_CODIGO, OPERACION_ADJUNTOS_DESCARGAR),
    getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_ADJUNTOS_CODIGO, OPERACION_ADJUNTOS_GUARDAR),
    getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_ADJUNTOS_CODIGO, OPERACION_ADJUNTOS_BORRAR),
  ]);

  return { crear, reemplazar, descargar, guardar, borrar };
}
