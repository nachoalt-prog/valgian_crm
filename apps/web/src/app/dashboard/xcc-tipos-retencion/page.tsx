import { getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { listTiposRetencionAdmin } from "@valgian/module-cuenta-corriente";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { XccTiposRetencionTool } from "@/components/xcc-tipos-retencion-tool";

const HERRAMIENTA_CODIGO = "xcc_tipos_retencion";

export default async function XccTiposRetencionPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Tipos de Retención (Cuenta Corriente)" />;
  }

  const tipos = await listTiposRetencionAdmin();

  return <XccTiposRetencionTool tiposIniciales={tipos} canGestionar={tieneAcceso} />;
}
