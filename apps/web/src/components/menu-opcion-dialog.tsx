"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ICON_KEYS } from "@/lib/icons";
import type { MenuOpcionConHerramienta } from "@valgian/core";

interface HerramientaOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface MenuOpcionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opcion: MenuOpcionConHerramienta | null;
  menuId: string;
  herramientas: HerramientaOption[];
  onSave: (
    data: {
      idMenu: string;
      idHerramienta: string | null;
      codigo: string;
      nombre: string;
      icono: string | null;
      orden: number | null;
    },
    id?: string,
  ) => Promise<{ error?: string } | void>;
}

// key={opcion?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function MenuOpcionDialog({ open, onOpenChange, opcion, menuId, herramientas, onSave }: MenuOpcionDialogProps) {
  const [codigo, setCodigo] = useState(opcion?.codigo ?? "");
  const [nombre, setNombre] = useState(opcion?.nombre ?? "");
  const [idHerramienta, setIdHerramienta] = useState<string | null>(opcion?.idHerramienta ?? null);
  const [icono, setIcono] = useState<string | null>(opcion?.icono ?? null);
  const [orden, setOrden] = useState<string>(opcion?.orden != null ? String(opcion.orden) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave(
      {
        idMenu: menuId,
        idHerramienta,
        codigo,
        nombre,
        icono,
        orden: orden.trim() === "" ? null : Number(orden),
      },
      opcion?.id,
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
          <DialogTitle>{opcion ? "Editar Opción" : "Nueva Opción"}</DialogTitle>
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
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Herramienta</Label>
            <Select
              items={Object.fromEntries(herramientas.map((h) => [h.id, `[${h.codigo}] ${h.nombre}`]))}
              value={idHerramienta ?? undefined}
              onValueChange={(v) => setIdHerramienta(v)}
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
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ícono</Label>
            <Select
              items={Object.fromEntries(ICON_KEYS.map((key) => [key, key]))}
              value={icono ?? undefined}
              onValueChange={(v) => setIcono(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin ícono" />
              </SelectTrigger>
              <SelectContent>
                {ICON_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="orden" className="text-xs uppercase tracking-wider text-muted-foreground">
              Orden
            </Label>
            <Input id="orden" type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {opcion ? "Guardar cambios" : "Crear opción"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
