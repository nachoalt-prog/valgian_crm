import { getPermisoParaOperacion, OPERACION_ACCESO, listPlantillasAdjunto } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { PlantillasAdjuntosTool } from "@/components/plantillas-adjuntos-tool";

const HERRAMIENTA_CODIGO = "plantillas_adjuntos";

export default async function PlantillasAdjuntosPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Plantillas de Documento" />;
  }

  const plantillas = await listPlantillasAdjunto();

  return <PlantillasAdjuntosTool plantillasIniciales={plantillas} canGestionar={tieneAcceso} />;
}
