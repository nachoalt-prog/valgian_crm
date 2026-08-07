"use server";

import {
  listImportadoresParaWizard,
  cargarArchivoWizard,
  confirmarImportacionWizard,
  cancelarImportacionWizard,
  getResultadosValidacion,
  getEjecucionImportador,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "importar";
const NO_ACCESO = "No tenés acceso a esta herramienta.";

async function requireAcceso(): Promise<{ error?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_ACCESO };

  return { usuarioId: session.usuario.id };
}

export async function listImportadoresParaWizardAction() {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };

  const data = await listImportadoresParaWizard();
  return { data };
}

export async function cargarArchivoWizardAction(idImportador: string, formData: FormData) {
  const check = await requireAcceso();
  if (check.error || !check.usuarioId) return { error: check.error ?? "No autenticado." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) return { error: "No se recibió ningún archivo." };

  const buffer = Buffer.from(await archivo.arrayBuffer());
  return cargarArchivoWizard(idImportador, check.usuarioId, buffer, archivo.name);
}

export async function getResultadosValidacionAction(idEjecucion: string, pagina: number) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };

  return getResultadosValidacion(idEjecucion, pagina);
}

export async function getEjecucionImportadorAction(idEjecucion: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };

  return getEjecucionImportador(idEjecucion);
}

export async function confirmarImportacionWizardAction(idEjecucion: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };

  return confirmarImportacionWizard(idEjecucion);
}

export async function cancelarImportacionWizardAction(idEjecucion: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };

  return cancelarImportacionWizard(idEjecucion);
}
