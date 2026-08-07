import { getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { ImportarWizard } from "@/components/importar-wizard";

const HERRAMIENTA_CODIGO = "importar";

export default async function ImportarPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Asistente de Importación" />;
  }

  return <ImportarWizard />;
}
