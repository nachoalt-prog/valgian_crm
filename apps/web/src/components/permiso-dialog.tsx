"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PermisoConNombres, OperacionOption } from "@valgian/core";

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
  operaciones: OperacionOption[];
  onSave: (data: { idPerfil: string; idOperacion: string }, id?: string) => Promise<{ error?: string } | void>;
}

// key={permiso?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function PermisoDialog({ open, onOpenChange, permiso, perfiles, herramientas, operaciones, onSave }: PermisoDialogProps) {
  const [idPerfil, setIdPerfil] = useState<string | null>(permiso?.idPerfil ?? null);
  const [idHerramienta, setIdHerramienta] = useState<string | null>(permiso?.idHerramienta ?? null);
  const [idOperacion, setIdOperacion] = useState<string | null>(permiso?.idOperacion ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const operacionesDeLaHerramienta = operaciones.filter((o) => o.idHerramienta === idHerramienta);

  function handleHerramientaChange(v: string) {
    setIdHerramienta(v);
    // Cambiar de herramienta invalida la operación elegida — las opciones son otras.
    setIdOperacion(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idPerfil || !idOperacion) {
      setError("Elegí un perfil, una herramienta y una operación.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await onSave({ idPerfil, idOperacion }, permiso?.id);
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
              onValueChange={handleHerramientaChange}
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

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Operación</Label>
            <Select
              items={Object.fromEntries(operacionesDeLaHerramienta.map((o) => [o.id, `[${o.codigo}] ${o.nombre}`]))}
              value={idOperacion ?? undefined}
              onValueChange={(v) => setIdOperacion(v)}
              disabled={!idHerramienta}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={idHerramienta ? "Seleccioná una operación…" : "Elegí primero una herramienta"} />
              </SelectTrigger>
              <SelectContent>
                {operacionesDeLaHerramienta.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    [{o.codigo}] {o.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
