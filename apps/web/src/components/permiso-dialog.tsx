"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PermisoConNombres } from "@valgian/core";

interface Option {
  id: string;
  codigo: string;
  nombre: string;
}

interface PermisoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permiso: PermisoConNombres | null;
  perfiles: Option[];
  herramientas: Option[];
  onSave: (data: { idPerfil: string; idHerramienta: string; gestionar: boolean }, id?: string) => Promise<{ error?: string } | void>;
}

// key={permiso?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function PermisoDialog({ open, onOpenChange, permiso, perfiles, herramientas, onSave }: PermisoDialogProps) {
  const [idPerfil, setIdPerfil] = useState<string | null>(permiso?.idPerfil ?? null);
  const [idHerramienta, setIdHerramienta] = useState<string | null>(permiso?.idHerramienta ?? null);
  const [gestionar, setGestionar] = useState(permiso?.gestionar ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idPerfil || !idHerramienta) {
      setError("Elegí un perfil y una herramienta.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await onSave({ idPerfil, idHerramienta, gestionar }, permiso?.id);
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
          <DialogTitle>{permiso ? "Editar Permiso" : "Nuevo Permiso"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Perfil</Label>
            <Select
              items={Object.fromEntries(perfiles.map((p) => [p.id, `[${p.codigo}] ${p.nombre}`]))}
              value={idPerfil ?? undefined}
              onValueChange={(v) => setIdPerfil(v)}
              disabled={!!permiso}
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
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Herramienta</Label>
            <Select
              items={Object.fromEntries(herramientas.map((h) => [h.id, `[${h.codigo}] ${h.nombre}`]))}
              value={idHerramienta ?? undefined}
              onValueChange={(v) => setIdHerramienta(v)}
              disabled={!!permiso}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná una herramienta…" />
              </SelectTrigger>
              <SelectContent>
                {herramientas.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    [{h.codigo}] {h.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={gestionar}
              onChange={(e) => setGestionar(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="text-sm text-foreground">Puede gestionar (crear/editar/borrar)</span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {permiso ? "Guardar cambios" : "Crear permiso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
