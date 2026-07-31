import { getPermisoParaOperacion, OPERACION_ACCESO, listPerfilesEstimulos, listPerfiles, listEstimulosConEstrategia } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { PerfilesEstimulosTool } from "@/components/perfiles-estimulos-tool";

const HERRAMIENTA_CODIGO = "perfiles_estimulos";

export default async function PerfilesEstimulosPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Perfiles-Estímulos" />;
  }

  const [vinculos, perfiles, estimulos] = await Promise.all([listPerfilesEstimulos(), listPerfiles(), listEstimulosConEstrategia()]);

  return (
    <PerfilesEstimulosTool vinculosIniciales={vinculos} perfiles={perfiles} estimulos={estimulos} canGestionar={tieneAcceso} />
  );
}
