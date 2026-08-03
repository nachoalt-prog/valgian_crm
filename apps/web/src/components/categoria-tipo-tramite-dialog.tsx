"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoriaTipoTramiteInput } from "@valgian/core";

interface CategoriaRow {
  id: string;
  codigo: string;
  nombre: string;
  prefijo: string;
}

interface CategoriaTipoTramiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria: CategoriaRow | null;
  onSave: (data: CategoriaTipoTramiteInput, id?: string) => Promise<{ error?: string } | void>;
}

// key={categoria?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function CategoriaTipoTramiteDialog({ open, onOpenChange, categoria, onSave }: CategoriaTipoTramiteDialogProps) {
  const [codigo, setCodigo] = useState(categoria?.codigo ?? "");
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [prefijo, setPrefijo] = useState(categoria?.prefijo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave({ codigo, nombre, prefijo }, categoria?.id);
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
          <DialogTitle>{categoria ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="codigo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Código
            </Label>
            <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ej. sobre_legajos" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre" className="text-xs uppercase tracking-wider text-muted-foreground">
              Nombre
            </Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="ej. Sobre Legajos" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prefijo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Prefijo
            </Label>
            <Input
              id="prefijo"
              value={prefijo}
              onChange={(e) => setPrefijo(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="ej. LEG"
              maxLength={3}
              className="font-mono text-sm uppercase"
              required
            />
            <p className="text-xs text-muted-foreground">1 a 3 letras mayúsculas — antepone el número de cada trámite de esta categoría (ej. LEG000001).</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {categoria ? "Guardar cambios" : "Crear categoría"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
