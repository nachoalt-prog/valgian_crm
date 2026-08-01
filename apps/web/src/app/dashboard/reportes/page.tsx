import { getPermisoParaOperacion, OPERACION_ACCESO, listReportesParaPerfil } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { ReportesTool } from "@/components/reportes-tool";

const HERRAMIENTA_CODIGO = "reportes";

export default async function ReportesPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso || !session?.perfil) {
    return <SinAcceso herramienta="Reportes" />;
  }

  const reportes = await listReportesParaPerfil(session.perfil.id);

  return <ReportesTool reportesIniciales={reportes} />;
}
