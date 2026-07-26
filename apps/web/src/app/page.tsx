import { getTemaPorDefecto } from "@valgian/core";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  // El login no tiene sesión todavía — siempre usa la interfaz "default".
  // Ver domain/infraestructura.md ("Interfaz").
  const tema = await getTemaPorDefecto();

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background p-6">
      {tema?.imagenFondo && (
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${tema.imagenFondo})` }}
        />
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
