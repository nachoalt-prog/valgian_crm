"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ProcesoInput } from "@valgian/core";

interface ProcesoRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  cron: string;
  activo: boolean | null;
  reintentoMinutos: number | null;
  reintentosMax: number | null;
}

interface ProcesoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proceso: ProcesoRow | null;
  onSave: (data: ProcesoInput, id?: string) => Promise<{ error?: string } | void>;
}

// key={proceso?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function ProcesoDialog({ open, onOpenChange, proceso, onSave }: ProcesoDialogProps) {
  const [codigo, setCodigo] = useState(proceso?.codigo ?? "");
  const [nombre, setNombre] = useState(proceso?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(proceso?.descripcion ?? "");
  const [cron, setCron] = useState(proceso?.cron ?? "");
  const [activo, setActivo] = useState(proceso?.activo ?? true);
  const [reintentoMinutos, setReintentoMinutos] = useState(proceso?.reintentoMinutos != null ? String(proceso.reintentoMinutos) : "");
  const [reintentosMax, setReintentosMax] = useState(proceso?.reintentosMax != null ? String(proceso.reintentosMax) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave(
      {
        codigo,
        nombre,
        descripcion: descripcion.trim() || null,
        cron,
        activo,
        reintentoMinutos: reintentoMinutos.trim() === "" ? null : Number(reintentoMinutos),
        reintentosMax: reintentosMax.trim() === "" ? null : Number(reintentosMax),
      },
      proceso?.id,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{proceso ? "Editar Proceso" : "Nuevo Proceso"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="codigo" className="text-xs uppercase tracking-wider text-muted-foreground">
                Código
              </Label>
              <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ej. limpieza_tokens_vencidos" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nombre" className="text-xs uppercase tracking-wider text-muted-foreground">
                Nombre
              </Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion" className="text-xs uppercase tracking-wider text-muted-foreground">
              Descripción
            </Label>
            <Input id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cron" className="text-xs uppercase tracking-wider text-muted-foreground">
              Expresión cron
            </Label>
            <Input id="cron" value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 1 * * *" className="font-mono text-sm" required />
            <p className="text-xs text-muted-foreground">
              5 campos: minuto hora día-mes mes día-semana. Ej. <code className="font-mono">0 1 * * *</code> = todos los días a la 1am,{" "}
              <code className="font-mono">*/15 * * * *</code> = cada 15 minutos. Evaluada en la zona horaria de esta instalación.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <Label htmlFor="activo" className="text-sm font-normal">
              Activo
            </Label>
            <Switch id="activo" checked={activo} onCheckedChange={setActivo} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="reintentoMinutos" className="text-xs uppercase tracking-wider text-muted-foreground">
                Reintentar cada (min)
              </Label>
              <Input id="reintentoMinutos" type="number" min={0} value={reintentoMinutos} onChange={(e) => setReintentoMinutos(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reintentosMax" className="text-xs uppercase tracking-wider text-muted-foreground">
                Reintentos máx.
              </Label>
              <Input id="reintentosMax" type="number" min={0} value={reintentosMax} onChange={(e) => setReintentosMax(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Vacío en cualquiera de los dos = no reintenta ante un fallo.</p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {proceso ? "Guardar cambios" : "Crear proceso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
