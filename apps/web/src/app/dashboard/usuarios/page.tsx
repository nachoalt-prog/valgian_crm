import { getPermisoParaOperacion, OPERACION_ACCESO, listPerfiles, listUsuarios, listInterfaces } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { UsuariosPerfilesTool } from "@/components/usuarios-perfiles-tool";

const HERRAMIENTA_CODIGO = "usuarios_perfiles";

export default async function UsuariosPerfilesPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Usuarios y Perfiles" />;
  }

  const [perfiles, usuarios, interfaces] = await Promise.all([listPerfiles(), listUsuarios(), listInterfaces()]);

  return (
    <UsuariosPerfilesTool
      perfilesIniciales={perfiles}
      usuariosIniciales={usuarios}
      interfaces={interfaces}
      canGestionar={tieneAcceso}
    />
  );
}
