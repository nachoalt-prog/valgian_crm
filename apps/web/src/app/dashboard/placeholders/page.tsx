import { getPermisoParaHerramienta, listPlaceholders } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { PlaceholdersTool } from "@/components/placeholders-tool";

const HERRAMIENTA_CODIGO = "placeholders";

export default async function PlaceholdersPage() {
  const session = await getCurrentSession();
  const permiso = session?.perfil ? await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO) : null;

  if (!permiso) {
    return <SinAcceso herramienta="Placeholders" />;
  }

  const placeholders = await listPlaceholders();

  return <PlaceholdersTool placeholdersIniciales={placeholders} canGestionar={permiso.gestionar} />;
}
