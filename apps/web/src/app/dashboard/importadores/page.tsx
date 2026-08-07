import { getPermisoParaOperacion, OPERACION_ACCESO, listImportadoresAdmin } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { ImportadoresTool } from "@/components/importadores-tool";

const HERRAMIENTA_CODIGO = "importadores";

export default async function ImportadoresPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Importadores" />;
  }

  const importadoresIniciales = await listImportadoresAdmin();

  return <ImportadoresTool importadoresIniciales={importadoresIniciales} canGestionar={tieneAcceso} />;
}
