"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductoConCategoria } from "@valgian/core";

interface MonedaOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface ProductoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: ProductoConCategoria | null;
  categoriaId: string;
  monedas: MonedaOption[];
  onSave: (data: { idCategoria: string; idMoneda: string | null; codigo: string; nombre: string }, id?: string) => Promise<{ error?: string } | void>;
}

// key={producto?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function ProductoDialog({ open, onOpenChange, producto, categoriaId, monedas, onSave }: ProductoDialogProps) {
  const [codigo, setCodigo] = useState(producto?.codigo ?? "");
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [idMoneda, setIdMoneda] = useState<string | null>(producto?.idMoneda ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave({ idCategoria: categoriaId, idMoneda, codigo, nombre }, producto?.id);
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
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Moneda</Label>
            <Select items={Object.fromEntries(monedas.map((m) => [m.id, m.nombre]))} value={idMoneda ?? undefined} onValueChange={(v) => setIdMoneda(v ?? null)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin moneda…" />
              </SelectTrigger>
              <SelectContent>
                {monedas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
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
              {producto ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
