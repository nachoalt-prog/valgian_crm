import { getPermisoParaOperacion, OPERACION_ACCESO, listPermisos, listPerfiles, listHerramientas, listOperaciones } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { PermisosTool } from "@/components/permisos-tool";

const HERRAMIENTA_CODIGO = "permisos";

export default async function PermisosPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Permisos" />;
  }

  const [permisos, perfiles, herramientas, operaciones] = await Promise.all([
    listPermisos(),
    listPerfiles(),
    listHerramientas(),
    listOperaciones(),
  ]);

  return (
    <PermisosTool
      permisosIniciales={permisos}
      perfiles={perfiles}
      herramientas={herramientas}
      operaciones={operaciones}
      canGestionar={tieneAcceso}
    />
  );
}
