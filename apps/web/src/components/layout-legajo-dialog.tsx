"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LayoutLegajoInput } from "@valgian/core";

interface LayoutRow {
  id: string;
  codigo: string;
  nombre: string;
}

interface LayoutLegajoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: LayoutRow | null;
  onSave: (data: LayoutLegajoInput, id?: string) => Promise<{ error?: string } | void>;
}

// key={layout?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function LayoutLegajoDialog({ open, onOpenChange, layout, onSave }: LayoutLegajoDialogProps) {
  const [codigo, setCodigo] = useState(layout?.codigo ?? "");
  const [nombre, setNombre] = useState(layout?.nombre ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave({ codigo, nombre }, layout?.id);
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
          <DialogTitle>{layout ? "Editar Layout" : "Nuevo Layout"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="codigo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Código
            </Label>
            <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nombre" className="text-xs uppercase tracking-wider text-muted-foreground">
              Nombre
            </Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {layout ? "Guardar cambios" : "Crear layout"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
