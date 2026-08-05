"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CategoriaProductoConContador } from "@valgian/core";

interface CategoriaProductoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoria: CategoriaProductoConContador | null;
  onSave: (
    data: { modulo: string | null; codigo: string; nombre: string; spPago: string | null; spAnularPago: string | null },
    id?: string,
  ) => Promise<{ error?: string } | void>;
}

// key={categoria?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function CategoriaProductoDialog({ open, onOpenChange, categoria, onSave }: CategoriaProductoDialogProps) {
  const [modulo, setModulo] = useState(categoria?.modulo ?? "");
  const [codigo, setCodigo] = useState(categoria?.codigo ?? "");
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [spPago, setSpPago] = useState(categoria?.spPago ?? "");
  const [spAnularPago, setSpAnularPago] = useState(categoria?.spAnularPago ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave(
      { modulo: modulo || null, codigo, nombre, spPago: spPago.trim() || null, spAnularPago: spAnularPago.trim() || null },
      categoria?.id,
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
          <DialogTitle>{categoria ? "Editar Categoría de Producto" : "Nueva Categoría de Producto"}</DialogTitle>
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
              placeholder="ej. XCC"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Código del módulo opcional dueño de esta categoría. Opcional.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="spPago" className="text-xs uppercase tracking-wider text-muted-foreground">
                SP Pago
              </Label>
              <Input id="spPago" value={spPago} onChange={(e) => setSpPago(e.target.value)} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spAnularPago" className="text-xs uppercase tracking-wider text-muted-foreground">
                SP Anular Pago
              </Label>
              <Input id="spAnularPago" value={spAnularPago} onChange={(e) => setSpAnularPago(e.target.value)} className="font-mono text-sm" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Nombres de SP invocados por el motor genérico de pagos para impactar/anular un pago de esta categoría. Opcional.
          </p>

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
