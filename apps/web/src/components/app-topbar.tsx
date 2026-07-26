import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function iniciales(username: string) {
  return username.slice(0, 2).toUpperCase();
}

export function AppTopbar({ username, perfilNombre }: { username: string; perfilNombre: string | undefined }) {
  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-end gap-4 px-5 shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-foreground leading-none">{username}</p>
          {perfilNombre && <p className="text-xs text-muted-foreground mt-0.5">{perfilNombre}</p>}
        </div>
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
            {iniciales(username)}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
