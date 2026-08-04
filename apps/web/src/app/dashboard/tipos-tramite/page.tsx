import { getPermisoParaOperacion, OPERACION_ACCESO, listTiposTramiteAdmin, listCategoriasTiposTramite, listEstrategias, listEntidades } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { TiposTramiteAdminTool } from "@/components/tipos-tramite-admin-tool";

const HERRAMIENTA_CODIGO = "tipos_tramite";

export default async function TiposTramitePage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Tipos de Trámite" />;
  }

  const [tipos, categorias, estrategias, entidades] = await Promise.all([
    listTiposTramiteAdmin(),
    listCategoriasTiposTramite(),
    listEstrategias(),
    listEntidades(),
  ]);

  return <TiposTramiteAdminTool tiposIniciales={tipos} categorias={categorias} estrategias={estrategias} entidades={entidades} canGestionar={tieneAcceso} />;
}
