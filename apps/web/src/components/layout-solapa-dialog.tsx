"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEGAJO_HERRAMIENTAS } from "@/lib/legajo-herramientas";
import type { SolapaConNombre } from "@valgian/core";

interface HerramientaOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface LayoutSolapaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  solapa: SolapaConNombre | null;
  herramientasDisponibles: HerramientaOption[];
  onSave: (data: { orden: number; nombre: string; idHerramienta: string | null; visible: boolean }, id?: string) => Promise<{ error?: string } | void>;
}

const SIN_HERRAMIENTA = "__ninguna__";
const ORDENES = Array.from({ length: 10 }, (_, i) => i + 1);

// key={solapa?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function LayoutSolapaDialog({ open, onOpenChange, solapa, herramientasDisponibles, onSave }: LayoutSolapaDialogProps) {
  // Solo se pueden asignar herramientas que el frontend efectivamente sabe renderizar
  // dentro de una solapa (ver lib/legajo-herramientas.ts) — evita configurar una
  // herramienta "huérfana" que después muestre el error de "no registrada".
  const opciones = herramientasDisponibles.filter((h) => h.codigo in LEGAJO_HERRAMIENTAS);

  // Default fijo en 1 (no "próximo disponible"): mismo criterio que
  // BandejaFiltroDialog — evita depender de props que quedan stale si el
  // diálogo no se remonta entre aperturas sucesivas de "nueva solapa".
  const [orden, setOrden] = useState(String(solapa?.orden ?? 1));
  const [nombre, setNombre] = useState(solapa?.nombre ?? "");
  const [idHerramienta, setIdHerramienta] = useState(solapa?.idHerramienta ?? SIN_HERRAMIENTA);
  const [visible, setVisible] = useState(solapa?.visible ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const idHerramientaFinal = idHerramienta === SIN_HERRAMIENTA ? null : idHerramienta;
    const result = await onSave({ orden: Number(orden), nombre, idHerramienta: idHerramientaFinal, visible }, solapa?.id);
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
          <DialogTitle>{solapa ? "Editar Solapa" : "Nueva Solapa"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Orden (1 a 10)</Label>
              <Select items={Object.fromEntries(ORDENES.map((n) => [String(n), String(n)]))} value={orden} onValueChange={(v) => setOrden(v ?? "1")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDENES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nombreSolapa" className="text-xs uppercase tracking-wider text-muted-foreground">
                Nombre de la solapa
              </Label>
              <Input id="nombreSolapa" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Herramienta</Label>
            <Select
              items={{ [SIN_HERRAMIENTA]: "Ninguna (solapa vacía)", ...Object.fromEntries(opciones.map((h) => [h.id, h.nombre])) }}
              value={idHerramienta}
              onValueChange={(v) => setIdHerramienta(v ?? SIN_HERRAMIENTA)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_HERRAMIENTA}>Ninguna (solapa vacía)</SelectItem>
                {opciones.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="size-4 accent-primary" />
            <span className="text-sm text-foreground">Visible</span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {solapa ? "Guardar cambios" : "Agregar solapa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
