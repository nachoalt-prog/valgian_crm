"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PerfilEstimuloInput, EstimuloConEstrategia } from "@valgian/core";

interface PerfilOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface PerfilEstimuloDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perfiles: PerfilOption[];
  estimulos: EstimuloConEstrategia[];
  onSave: (data: PerfilEstimuloInput) => Promise<{ error?: string } | void>;
}

export function PerfilEstimuloDialog({ open, onOpenChange, perfiles, estimulos, onSave }: PerfilEstimuloDialogProps) {
  const [idPerfil, setIdPerfil] = useState<string | null>(null);
  const [idEstimulo, setIdEstimulo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idPerfil || !idEstimulo) {
      setError("Elegí un perfil y un estímulo.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await onSave({ idPerfil, idEstimulo });
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setIdPerfil(null);
    setIdEstimulo(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Perfil-Estímulo</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Perfil</Label>
            <Select
              items={Object.fromEntries(perfiles.map((p) => [p.id, `[${p.codigo}] ${p.nombre}`]))}
              value={idPerfil}
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
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Estímulo</Label>
            <Select
              items={Object.fromEntries(estimulos.map((e) => [e.id, `${e.estrategiaNombre ?? "—"} - ${e.nombre}`]))}
              value={idEstimulo}
              onValueChange={(v) => setIdEstimulo(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná un estímulo…" />
              </SelectTrigger>
              <SelectContent>
                {estimulos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.estrategiaNombre ?? "—"} - {e.nombre}
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
              Crear vínculo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
