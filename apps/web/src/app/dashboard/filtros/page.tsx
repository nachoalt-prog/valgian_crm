import { getPermisoParaOperacion, OPERACION_ACCESO, listFiltros } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { FiltrosTool } from "@/components/filtros-tool";

const HERRAMIENTA_CODIGO = "filtros";

export default async function FiltrosPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Filtros" />;
  }

  const filtros = await listFiltros();

  return <FiltrosTool filtrosIniciales={filtros} canGestionar={tieneAcceso} />;
}
