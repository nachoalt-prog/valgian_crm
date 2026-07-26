import { getPermisoParaHerramienta, listBandejasAdmin, listFiltros, listLayoutsLegajoAdmin } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { BandejasAdminTool } from "@/components/bandejas-admin-tool";

const HERRAMIENTA_CODIGO = "bandejas_admin";

export default async function BandejasAdminPage() {
  const session = await getCurrentSession();
  const permiso = session?.perfil ? await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO) : null;

  if (!permiso) {
    return <SinAcceso herramienta="Bandejas (ABM)" />;
  }

  const [bandejas, filtrosDisponibles, layoutsDisponibles] = await Promise.all([
    listBandejasAdmin(),
    listFiltros(),
    listLayoutsLegajoAdmin(),
  ]);

  return (
    <BandejasAdminTool
      bandejasIniciales={bandejas}
      filtrosDisponibles={filtrosDisponibles}
      layoutsDisponibles={layoutsDisponibles}
      canGestionar={permiso.gestionar}
    />
  );
}
