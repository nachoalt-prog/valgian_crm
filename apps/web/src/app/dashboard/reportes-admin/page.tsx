import { getPermisoParaOperacion, OPERACION_ACCESO, listReportesAdmin, listReportesCategorias, listFiltros } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { ReportesAdminTool } from "@/components/reportes-admin-tool";

const HERRAMIENTA_CODIGO = "reportes_admin";

export default async function ReportesAdminPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Reportes (ABM)" />;
  }

  const [reportes, categorias, filtrosDisponibles] = await Promise.all([listReportesAdmin(), listReportesCategorias(), listFiltros()]);

  return <ReportesAdminTool reportesIniciales={reportes} categorias={categorias} filtrosDisponibles={filtrosDisponibles} canGestionar={tieneAcceso} />;
}
