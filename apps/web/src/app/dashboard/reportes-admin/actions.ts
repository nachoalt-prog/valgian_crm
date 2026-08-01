"use server";

import { revalidatePath } from "next/cache";
import {
  createReporte,
  updateReporte,
  deleteReporte,
  listReporteFiltros,
  createReporteFiltro,
  updateReporteFiltro,
  deleteReporteFiltro,
  getPerfilesConEstadoReporte,
  toggleReportePerfil,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type ReporteInput,
  type ReporteFiltroInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "reportes_admin";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createReporteAction(data: ReporteInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createReporte(data);
  if (result.data) revalidatePath("/dashboard/reportes-admin");
  return result;
}

export async function updateReporteAction(id: string, data: ReporteInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateReporte(id, data);
  if (result.data) revalidatePath("/dashboard/reportes-admin");
  return result;
}

export async function deleteReporteAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteReporte(id);
  if (result.data) revalidatePath("/dashboard/reportes-admin");
  return result;
}

export async function listReporteFiltrosAction(reporteId: string) {
  return listReporteFiltros(reporteId);
}

export async function createReporteFiltroAction(data: ReporteFiltroInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createReporteFiltro(data);
  if (result.data) revalidatePath("/dashboard/reportes-admin");
  return result;
}

export async function updateReporteFiltroAction(id: string, data: { idFiltro: string; campo: string; orden: number }) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateReporteFiltro(id, data);
  if (result.data) revalidatePath("/dashboard/reportes-admin");
  return result;
}

export async function deleteReporteFiltroAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteReporteFiltro(id);
  if (result.data) revalidatePath("/dashboard/reportes-admin");
  return result;
}

export async function getPerfilesConEstadoReporteAction(reporteId: string) {
  return getPerfilesConEstadoReporte(reporteId);
}

export async function toggleReportePerfilAction(reporteId: string, perfilId: string, activo: boolean) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await toggleReportePerfil(reporteId, perfilId, activo);
  if (result.data) revalidatePath("/dashboard/reportes-admin");
  return result;
}
