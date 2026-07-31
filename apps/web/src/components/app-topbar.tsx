import { AvatarEditor } from "@/components/avatar-editor";

export function AppTopbar({
  username,
  perfilNombre,
  idArchivoAdjunto,
}: {
  username: string;
  perfilNombre: string | undefined;
  idArchivoAdjunto: string | null;
}) {
  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-end gap-4 px-5 shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-foreground leading-none">{username}</p>
          {perfilNombre && <p className="text-xs text-muted-foreground mt-0.5">{perfilNombre}</p>}
        </div>
        <AvatarEditor username={username} idArchivoAdjuntoInicial={idArchivoAdjunto} />
      </div>
    </header>
  );
}
