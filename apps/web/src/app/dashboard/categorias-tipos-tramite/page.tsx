import { getPermisoParaOperacion, OPERACION_ACCESO, listCategoriasTiposTramite } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { CategoriasTiposTramiteTool } from "@/components/categorias-tipos-tramite-tool";

const HERRAMIENTA_CODIGO = "categorias_tipos_tramite";

export default async function CategoriasTiposTramitePage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Categorías de Tipos de Trámite" />;
  }

  const categorias = await listCategoriasTiposTramite();

  return <CategoriasTiposTramiteTool categoriasIniciales={categorias} canGestionar={tieneAcceso} />;
}
