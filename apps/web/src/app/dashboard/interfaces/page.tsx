import { getPermisoParaHerramienta, listInterfaces } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { InterfacesTool } from "@/components/interfaces-tool";

const HERRAMIENTA_CODIGO = "interfaces";

export default async function InterfacesPage() {
  const session = await getCurrentSession();
  const permiso = session?.perfil ? await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO) : null;

  if (!permiso) {
    return <SinAcceso herramienta="Interfaces" />;
  }

  const interfaces = await listInterfaces();

  return <InterfacesTool interfacesIniciales={interfaces} canGestionar={permiso.gestionar} />;
}
