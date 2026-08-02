"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MenuConContador } from "@valgian/core";

interface MenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menu: MenuConContador | null;
  onSave: (data: { codigo: string; nombre: string; orden: number | null; abierto: boolean }, id?: string) => Promise<{ error?: string } | void>;
}

// key={menu?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function MenuDialog({ open, onOpenChange, menu, onSave }: MenuDialogProps) {
  const [codigo, setCodigo] = useState(menu?.codigo ?? "");
  const [nombre, setNombre] = useState(menu?.nombre ?? "");
  const [orden, setOrden] = useState(menu?.orden != null ? String(menu.orden) : "");
  const [abierto, setAbierto] = useState(menu?.abierto ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave({ codigo, nombre, orden: orden.trim() === "" ? null : Number(orden), abierto }, menu?.id);
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
          <DialogTitle>{menu ? "Editar Menú" : "Nuevo Menú"}</DialogTitle>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="orden" className="text-xs uppercase tracking-wider text-muted-foreground">
                Orden
              </Label>
              <Input id="orden" type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <Label htmlFor="abierto" className="text-sm font-normal">
                Abierto por defecto
              </Label>
              <Switch id="abierto" checked={abierto} onCheckedChange={setAbierto} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {menu ? "Guardar cambios" : "Crear menú"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
