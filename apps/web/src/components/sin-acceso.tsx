import { ShieldAlert } from "lucide-react";

export function SinAcceso({ herramienta }: { herramienta: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <ShieldAlert className="size-10 text-destructive" />
      <h1 className="text-lg font-semibold text-foreground">No tenés acceso a esta herramienta</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tu perfil no tiene un permiso cargado para &quot;{herramienta}&quot;. Pedile a un administrador que te lo
        asigne si lo necesitás.
      </p>
    </div>
  );
}
