"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BandejaFiltroConNombre } from "@valgian/core";

interface FiltroOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface BandejaFiltroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vinculo: BandejaFiltroConNombre | null;
  filtrosDisponibles: FiltroOption[];
  onSave: (data: { idFiltro: string; campo: string; orden: number }, id?: string) => Promise<{ error?: string } | void>;
}

// key={vinculo?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function BandejaFiltroDialog({ open, onOpenChange, vinculo, filtrosDisponibles, onSave }: BandejaFiltroDialogProps) {
  const [idFiltro, setIdFiltro] = useState<string | null>(vinculo?.idFiltro ?? null);
  const [campo, setCampo] = useState(vinculo?.campo ?? "");
  const [orden, setOrden] = useState(String(vinculo?.orden ?? 1));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idFiltro) {
      setError("Elegí un filtro.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await onSave({ idFiltro, campo, orden: Number(orden) || 0 }, vinculo?.id);
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
          <DialogTitle>{vinculo ? "Editar Filtro de la Bandeja" : "Agregar Filtro a la Bandeja"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Filtro</Label>
            <Select
              items={Object.fromEntries(filtrosDisponibles.map((f) => [f.id, `[${f.codigo}] ${f.nombre}`]))}
              value={idFiltro}
              onValueChange={(v) => setIdFiltro(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná un filtro…" />
              </SelectTrigger>
              <SelectContent>
                {filtrosDisponibles.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    [{f.codigo}] {f.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Campo (alias de la query de la bandeja)
            </Label>
            <Input id="campo" value={campo} onChange={(e) => setCampo(e.target.value)} placeholder="ej: numero, estado_id" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="orden" className="text-xs uppercase tracking-wider text-muted-foreground">
              Orden en el formulario
            </Label>
            <Input id="orden" type="number" value={orden} onChange={(e) => setOrden(e.target.value)} required />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {vinculo ? "Guardar cambios" : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
