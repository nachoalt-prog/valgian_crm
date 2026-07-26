import { getPermisoParaHerramienta, listBandejasParaPerfil } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { BandejasTool } from "@/components/bandejas-tool";

const HERRAMIENTA_CODIGO = "bandejas";

export default async function BandejasPage() {
  const session = await getCurrentSession();
  const permiso = session?.perfil ? await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO) : null;

  if (!permiso || !session?.perfil) {
    return <SinAcceso herramienta="Bandejas" />;
  }

  const bandejas = await listBandejasParaPerfil(session.perfil.id);

  return <BandejasTool bandejasIniciales={bandejas} />;
}
