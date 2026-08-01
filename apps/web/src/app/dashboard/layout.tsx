import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, getMenuForPerfil, getTemaPorInterfaz } from "@valgian/core";
import { SESSION_COOKIE } from "@/lib/session";
import { THEME_COOKIE } from "@/lib/theme";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

// Acá se hace la validación REAL del token (vigente, no vencido) contra la base.
// El chequeo de src/proxy.ts es solo optimista — ver ese archivo.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const temaInicial = cookieStore.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";

  if (!token) {
    redirect("/");
  }

  const session = await getSessionUser(token);
  if (!session) {
    redirect("/");
  }

  const { usuario, perfil } = session;
  const menu = perfil ? await getMenuForPerfil(perfil.id, perfil.idInterfaz) : [];
  const tema = perfil?.idInterfaz ? await getTemaPorInterfaz(perfil.idInterfaz) : null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar menu={menu} titulo={tema?.titulo} temaInicial={temaInicial} />
      <div className="flex flex-col flex-1 min-w-0">
        <AppTopbar username={usuario.username} perfilNombre={perfil?.nombre} idArchivoAdjunto={usuario.idArchivoAdjunto} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
