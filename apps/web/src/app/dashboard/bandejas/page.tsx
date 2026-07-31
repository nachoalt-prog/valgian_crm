import { getPermisoParaOperacion, OPERACION_ACCESO, listBandejasParaPerfil } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { BandejasTool } from "@/components/bandejas-tool";

const HERRAMIENTA_CODIGO = "bandejas";

export default async function BandejasPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso || !session?.perfil) {
    return <SinAcceso herramienta="Bandejas" />;
  }

  const bandejas = await listBandejasParaPerfil(session.perfil.id);

  return <BandejasTool bandejasIniciales={bandejas} />;
}
