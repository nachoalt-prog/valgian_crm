import { getPermisoParaHerramienta, listPlantillasAdjunto } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { PlantillasAdjuntosTool } from "@/components/plantillas-adjuntos-tool";

const HERRAMIENTA_CODIGO = "plantillas_adjuntos";

export default async function PlantillasAdjuntosPage() {
  const session = await getCurrentSession();
  const permiso = session?.perfil ? await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO) : null;

  if (!permiso) {
    return <SinAcceso herramienta="Plantillas de Documento" />;
  }

  const plantillas = await listPlantillasAdjunto();

  return <PlantillasAdjuntosTool plantillasIniciales={plantillas} canGestionar={permiso.gestionar} />;
}
