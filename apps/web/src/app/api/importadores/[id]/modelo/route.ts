import { NextRequest, NextResponse } from "next/server";
import { getColumnasModeloImportador, getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

/**
 * Archivo modelo (solo el encabezado, CSV) de un importador — ruta aparte (no
 * server action) porque devuelve un archivo con Content-Disposition, mismo
 * patrón que apps/web/src/app/api/reportes/[id]/export/route.ts. Accesible
 * desde el ABM ("importadores") o el wizard ("importar") — cualquiera de los
 * dos permisos alcanza, ambas pantallas exponen el botón.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session?.perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const [accesoAbm, accesoWizard] = await Promise.all([
    getPermisoParaOperacion(session.perfil.id, "importadores", OPERACION_ACCESO),
    getPermisoParaOperacion(session.perfil.id, "importar", OPERACION_ACCESO),
  ]);
  if (!accesoAbm && !accesoWizard) return NextResponse.json({ error: "No tenés acceso." }, { status: 403 });

  const resultado = await getColumnasModeloImportador(id);
  if (resultado.error || !resultado.data) {
    return NextResponse.json({ error: resultado.error ?? "No se pudo generar el archivo modelo." }, { status: 404 });
  }

  const { codigo, encabezados } = resultado.data;
  const contenido = encabezados.join(",") + "\n";

  return new NextResponse(`﻿${contenido}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${codigo}_modelo.csv"`,
    },
  });
}
