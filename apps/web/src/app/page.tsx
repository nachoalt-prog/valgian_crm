import { cookies } from "next/headers";
import { getTemaPorDefecto } from "@valgian/core";
import { LoginForm } from "@/components/login-form";
import { INTERFAZ_COLORES_COOKIE, parseInterfazColoresCookie } from "@/lib/interfaz-colores";

export default async function LoginPage() {
  // El login no tiene sesión todavía — primero la imagen de la última sesión
  // logueada en este navegador (INTERFAZ_COLORES_COOKIE, mismo criterio que
  // los colores en app/layout.tsx), y si no hay, recién ahí la interfaz
  // "default". Ver domain/infraestructura.md ("Interfaz").
  const cookieStore = await cookies();
  const cookie = parseInterfazColoresCookie(cookieStore.get(INTERFAZ_COLORES_COOKIE)?.value);
  const imagenFondo = cookie?.imagenFondo ?? (await getTemaPorDefecto())?.imagenFondo ?? null;

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background p-6">
      {imagenFondo && (
        <div aria-hidden className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${imagenFondo})` }} />
      )}
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-xs font-bold tracking-tight text-primary-foreground">CRM</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">Valgian CRM</h1>
          <p className="text-sm text-muted-foreground">Ingresá con tu usuario para continuar</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
