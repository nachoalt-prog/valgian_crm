import { getPermisoParaHerramienta, listLayoutsLegajoAdmin, listHerramientas } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { LayoutsLegajoTool } from "@/components/layouts-legajo-tool";

const HERRAMIENTA_CODIGO = "layouts_legajo";

export default async function LayoutsLegajoPage() {
  const session = await getCurrentSession();
  const permiso = session?.perfil ? await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO) : null;

  if (!permiso) {
    return <SinAcceso herramienta="Layouts de Legajo" />;
  }

  const [layouts, herramientas] = await Promise.all([listLayoutsLegajoAdmin(), listHerramientas()]);

  return <LayoutsLegajoTool layoutsIniciales={layouts} herramientasDisponibles={herramientas} canGestionar={permiso.gestionar} />;
}
