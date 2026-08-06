import { getPermisoParaOperacion, OPERACION_ACCESO } from "@valgian/core";
import { listCondicionesImpositivasAdmin } from "@valgian/module-cuenta-corriente";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { XccCondicionesImpositivasTool } from "@/components/xcc-condiciones-impositivas-tool";

const HERRAMIENTA_CODIGO = "xcc_condiciones_impositivas";

export default async function XccCondicionesImpositivasPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Condiciones Impositivas (Cuenta Corriente)" />;
  }

  const condiciones = await listCondicionesImpositivasAdmin();

  return <XccCondicionesImpositivasTool condicionesIniciales={condiciones} canGestionar={tieneAcceso} />;
}
