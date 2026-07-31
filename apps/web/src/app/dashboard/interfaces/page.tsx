import { getPermisoParaOperacion, OPERACION_ACCESO, listInterfaces } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { InterfacesTool } from "@/components/interfaces-tool";

const HERRAMIENTA_CODIGO = "interfaces";

export default async function InterfacesPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Interfaces" />;
  }

  const interfaces = await listInterfaces();

  return <InterfacesTool interfacesIniciales={interfaces} canGestionar={tieneAcceso} />;
}
