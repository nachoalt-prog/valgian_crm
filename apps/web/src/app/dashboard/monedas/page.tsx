import { getPermisoParaOperacion, OPERACION_ACCESO, listMonedasAdmin } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { MonedasTool } from "@/components/monedas-tool";

const HERRAMIENTA_CODIGO = "monedas";

export default async function MonedasPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Monedas" />;
  }

  const monedas = await listMonedasAdmin();

  return <MonedasTool monedasIniciales={monedas} canGestionar={tieneAcceso} />;
}
