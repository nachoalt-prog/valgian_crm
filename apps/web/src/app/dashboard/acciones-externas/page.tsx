import { getPermisoParaOperacion, OPERACION_ACCESO, listAccionesExternasAdmin } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { AccionesExternasTool } from "@/components/acciones-externas-tool";

const HERRAMIENTA_CODIGO = "acciones_externas";

export default async function AccionesExternasPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Acciones Externas" />;
  }

  const acciones = await listAccionesExternasAdmin();

  return <AccionesExternasTool accionesIniciales={acciones} canGestionar={tieneAcceso} />;
}
