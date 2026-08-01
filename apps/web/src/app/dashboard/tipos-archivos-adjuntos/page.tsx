import { getPermisoParaOperacion, OPERACION_ACCESO, listTiposArchivosAdjuntos } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { TiposArchivosAdjuntosTool } from "@/components/tipos-archivos-adjuntos-tool";

const HERRAMIENTA_CODIGO = "tipos_archivos_adjuntos";

export default async function TiposArchivosAdjuntosPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Tipos de Adjunto" />;
  }

  const tipos = await listTiposArchivosAdjuntos();

  return <TiposArchivosAdjuntosTool tiposIniciales={tipos} canGestionar={tieneAcceso} />;
}
