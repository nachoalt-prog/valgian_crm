import { getPermisoParaOperacion, OPERACION_ACCESO, listProcesosAdmin } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { ProcesosTool } from "@/components/procesos-tool";

const HERRAMIENTA_CODIGO = "procesos";

export default async function ProcesosPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Procesos" />;
  }

  const procesos = await listProcesosAdmin();

  return <ProcesosTool procesosIniciales={procesos} canGestionar={tieneAcceso} />;
}
