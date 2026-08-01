import { NextRequest, NextResponse } from "next/server";
import { listReportesParaPerfil, exportarReporte } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

/**
 * Export completo de un reporte (CSV/TSV) — ruta aparte (no server action)
 * porque necesita devolver un archivo con Content-Disposition, no un valor
 * serializable. Los filtros del formulario viajan como query params — solo
 * se aplican los que REPORTES_FILTROS tiene configurados para este reporte
 * (ver exportarReporte), así que parámetros extra/desconocidos no hacen nada.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session?.perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const permitidos = await listReportesParaPerfil(session.perfil.id);
  const reporte = permitidos.find((r) => r.id === id);
  if (!reporte) return NextResponse.json({ error: "No tenés acceso a este reporte." }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const formato = searchParams.get("formato") === "tsv" ? "tsv" : "csv";
  const valores: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key === "formato") continue;
    valores[key] = value;
  }

  const contenido = await exportarReporte(id, valores, formato);
  const extension = formato === "tsv" ? "tsv" : "csv";
  const mimetype = formato === "tsv" ? "text/tab-separated-values" : "text/csv";
  const nombreArchivo = `${reporte.codigo}.${extension}`;

  return new NextResponse(`﻿${contenido}`, {
    headers: {
      "Content-Type": `${mimetype}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
