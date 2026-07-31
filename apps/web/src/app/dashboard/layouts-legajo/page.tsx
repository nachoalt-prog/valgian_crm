import { getPermisoParaOperacion, OPERACION_ACCESO, listLayoutsLegajoAdmin, listHerramientas } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { LayoutsLegajoTool } from "@/components/layouts-legajo-tool";

const HERRAMIENTA_CODIGO = "layouts_legajo";

export default async function LayoutsLegajoPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Layouts de Legajo" />;
  }

  const [layouts, herramientas] = await Promise.all([listLayoutsLegajoAdmin(), listHerramientas()]);

  return <LayoutsLegajoTool layoutsIniciales={layouts} herramientasDisponibles={herramientas} canGestionar={tieneAcceso} />;
}
