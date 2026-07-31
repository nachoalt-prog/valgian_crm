import { getPermisoParaOperacion, OPERACION_ACCESO, listMenues, listMenuesOpciones, listHerramientas } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { MenuesTool } from "@/components/menues-tool";

const HERRAMIENTA_CODIGO = "menues";

export default async function MenuesPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Menúes y Opciones" />;
  }

  const [menues, opciones, herramientas] = await Promise.all([
    listMenues(),
    listMenuesOpciones(),
    listHerramientas(),
  ]);

  return (
    <MenuesTool
      menuesIniciales={menues}
      opcionesIniciales={opciones}
      herramientas={herramientas}
      canGestionar={tieneAcceso}
    />
  );
}
