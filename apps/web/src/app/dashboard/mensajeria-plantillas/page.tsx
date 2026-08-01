import { getPermisoParaOperacion, OPERACION_ACCESO, listMensajeriaPlantillas, listEstimulosConEstrategia } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { MensajeriaPlantillasTool } from "@/components/mensajeria-plantillas-tool";

const HERRAMIENTA_CODIGO = "mensajeria_plantillas";

export default async function MensajeriaPlantillasPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Plantillas de Mensajería" />;
  }

  const [plantillas, estimulos] = await Promise.all([listMensajeriaPlantillas(), listEstimulosConEstrategia()]);

  return <MensajeriaPlantillasTool plantillasIniciales={plantillas} estimulosDisponibles={estimulos} canGestionar={tieneAcceso} />;
}
