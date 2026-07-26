"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductoConContador } from "@valgian/core";

interface ProductoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: ProductoConContador | null;
  onSave: (data: { modulo: string | null; codigo: string; nombre: string }, id?: string) => Promise<{ error?: string } | void>;
}

// key={producto?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function ProductoDialog({ open, onOpenChange, producto, onSave }: ProductoDialogProps) {
  const [modulo, setModulo] = useState(producto?.modulo ?? "");
  const [codigo, setCodigo] = useState(producto?.codigo ?? "");
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave({ modulo: modulo || null, codigo, nombre }, producto?.id);
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
          <DialogTitle>{producto ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
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

          <div className="space-y-1.5">
            <Label htmlFor="modulo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Módulo
            </Label>
            <Input
              id="modulo"
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
              placeholder="ej. XP"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Prefijo de la tabla de extensión (ej. &quot;XP&quot;, &quot;XS&quot;). Opcional.</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {producto ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
