import { getPermisoParaHerramienta, listPermisos, listPerfiles, listHerramientas } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { PermisosTool } from "@/components/permisos-tool";

const HERRAMIENTA_CODIGO = "permisos";

export default async function PermisosPage() {
  const session = await getCurrentSession();
  const permiso = session?.perfil ? await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO) : null;

  if (!permiso) {
    return <SinAcceso herramienta="Permisos" />;
  }

  const [permisos, perfiles, herramientas] = await Promise.all([listPermisos(), listPerfiles(), listHerramientas()]);

  return (
    <PermisosTool
      permisosIniciales={permisos}
      perfiles={perfiles}
      herramientas={herramientas}
      canGestionar={permiso.gestionar}
    />
  );
}
