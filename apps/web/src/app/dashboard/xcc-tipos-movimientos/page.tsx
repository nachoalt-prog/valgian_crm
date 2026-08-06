import { getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { listTiposMovimientoAdmin } from "@valgian/module-cuenta-corriente";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { XccTiposMovimientoTool } from "@/components/xcc-tipos-movimiento-tool";

const HERRAMIENTA_CODIGO = "xcc_tipos_movimientos";

export default async function XccTiposMovimientoPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Tipos de Movimiento (Cuenta Corriente)" />;
  }

  const tipos = await listTiposMovimientoAdmin();

  return <XccTiposMovimientoTool tiposIniciales={tipos} canGestionar={tieneAcceso} />;
}
