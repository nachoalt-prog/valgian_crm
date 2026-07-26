import { getPermisoParaHerramienta, listFiltros } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { FiltrosTool } from "@/components/filtros-tool";

const HERRAMIENTA_CODIGO = "filtros";

export default async function FiltrosPage() {
  const session = await getCurrentSession();
  const permiso = session?.perfil ? await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO) : null;

  if (!permiso) {
    return <SinAcceso herramienta="Filtros" />;
  }

  const filtros = await listFiltros();

  return <FiltrosTool filtrosIniciales={filtros} canGestionar={permiso.gestionar} />;
}
