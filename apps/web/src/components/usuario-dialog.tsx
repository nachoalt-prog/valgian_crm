"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PerfilConContador, UsuarioConPerfil } from "@valgian/core";

interface UsuarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: UsuarioConPerfil | null;
  perfiles: PerfilConContador[];
  defaultPerfilId?: string | null;
  onSave: (
    data: { idPerfil: string | null; username: string; password?: string; avatarPath: string | null },
    id?: string,
  ) => Promise<{ error?: string } | void>;
}

// key={usuario?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function UsuarioDialog({ open, onOpenChange, usuario, perfiles, defaultPerfilId, onSave }: UsuarioDialogProps) {
  const [idPerfil, setIdPerfil] = useState<string | null>(usuario?.idPerfil ?? defaultPerfilId ?? null);
  const [username, setUsername] = useState(usuario?.username ?? "");
  const [password, setPassword] = useState("");
  const [avatarPath, setAvatarPath] = useState(usuario?.avatarPath ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave(
      { idPerfil, username, password: password || undefined, avatarPath: avatarPath || null },
      usuario?.id,
    );
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{usuario ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="idPerfil" className="text-xs uppercase tracking-wider text-muted-foreground">
              Perfil
            </Label>
            <Select
              items={Object.fromEntries(perfiles.map((p) => [p.id, `[${p.codigo}] ${p.nombre}`]))}
              value={idPerfil ?? undefined}
              onValueChange={(v) => setIdPerfil(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná un perfil…" />
              </SelectTrigger>
              <SelectContent>
                {perfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    [{p.codigo}] {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs uppercase tracking-wider text-muted-foreground">
              Username
            </Label>
            <Input
              id="username"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
              Contraseña{" "}
              {usuario && <span className="text-muted-foreground normal-case">(dejá vacío para no cambiar)</span>}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!usuario}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="avatarPath" className="text-xs uppercase tracking-wider text-muted-foreground">
              Avatar path
            </Label>
            <Input
              id="avatarPath"
              placeholder="/avatars/user.png"
              value={avatarPath}
              onChange={(e) => setAvatarPath(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {usuario ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
