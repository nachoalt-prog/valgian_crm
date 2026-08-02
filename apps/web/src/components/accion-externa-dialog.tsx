"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AccionExternaInput } from "@valgian/core";

interface AccionExternaRow {
  id: string;
  codigo: string;
  nombre: string;
  componente: string;
  parametros: unknown;
  activo: boolean | null;
  inmediato: boolean | null;
  reintentosMax: number | null;
  reintentosMargen: number | null;
}

interface AccionExternaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accion: AccionExternaRow | null;
  onSave: (data: AccionExternaInput, id?: string) => Promise<{ error?: string } | void>;
}

// key={accion?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function AccionExternaDialog({ open, onOpenChange, accion, onSave }: AccionExternaDialogProps) {
  const [codigo, setCodigo] = useState(accion?.codigo ?? "");
  const [nombre, setNombre] = useState(accion?.nombre ?? "");
  const [componente, setComponente] = useState(accion?.componente ?? "");
  const [activo, setActivo] = useState(accion?.activo ?? true);
  const [inmediato, setInmediato] = useState(accion?.inmediato ?? true);
  const [reintentosMax, setReintentosMax] = useState(accion?.reintentosMax != null ? String(accion.reintentosMax) : "");
  const [reintentosMargen, setReintentosMargen] = useState(accion?.reintentosMargen != null ? String(accion.reintentosMargen) : "");
  const [parametrosTexto, setParametrosTexto] = useState(accion?.parametros ? JSON.stringify(accion.parametros, null, 2) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let parametros: unknown = null;
    if (parametrosTexto.trim()) {
      try {
        parametros = JSON.parse(parametrosTexto);
      } catch {
        setError("Parámetros: el JSON no es válido.");
        return;
      }
    }

    setPending(true);
    const result = await onSave(
      {
        codigo,
        nombre,
        componente,
        parametros,
        activo,
        inmediato,
        reintentosMax: reintentosMax.trim() === "" ? null : Number(reintentosMax),
        reintentosMargen: reintentosMargen.trim() === "" ? null : Number(reintentosMargen),
      },
      accion?.id,
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
          <DialogTitle>{accion ? "Editar Acción Externa" : "Nueva Acción Externa"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="codigo" className="text-xs uppercase tracking-wider text-muted-foreground">
                Código
              </Label>
              <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ej. mensajeria_smtp" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nombre" className="text-xs uppercase tracking-wider text-muted-foreground">
                Nombre
              </Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="componente" className="text-xs uppercase tracking-wider text-muted-foreground">
              Componente
            </Label>
            <Input id="componente" value={componente} onChange={(e) => setComponente(e.target.value)} className="font-mono text-sm" required />
            <p className="text-xs text-muted-foreground">
              Nombre exacto con el que el handler se registra vía <code className="font-mono">registrarHandlerAccionExterna</code> — tiene que
              coincidir con el módulo que va a procesar esta acción.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <Label htmlFor="activo" className="text-sm font-normal">
                Activo
              </Label>
              <Switch id="activo" checked={activo} onCheckedChange={setActivo} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <Label htmlFor="inmediato" className="text-sm font-normal">
                Inmediato
              </Label>
              <Switch id="inmediato" checked={inmediato} onCheckedChange={setInmediato} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="reintentosMax" className="text-xs uppercase tracking-wider text-muted-foreground">
                Reintentos máx.
              </Label>
              <Input id="reintentosMax" type="number" min={0} value={reintentosMax} onChange={(e) => setReintentosMax(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reintentosMargen" className="text-xs uppercase tracking-wider text-muted-foreground">
                Margen (minutos)
              </Label>
              <Input id="reintentosMargen" type="number" min={0} value={reintentosMargen} onChange={(e) => setReintentosMargen(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="parametrosAccion" className="text-xs uppercase tracking-wider text-muted-foreground">
              Parámetros (JSON, opcional)
            </Label>
            <textarea
              id="parametrosAccion"
              value={parametrosTexto}
              onChange={(e) => setParametrosTexto(e.target.value)}
              rows={5}
              placeholder='{"host": "...", "port": 587, "usuario": "...", "contrasena": "...", "remitente": "..."}'
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">
              Configuración fija que necesita el componente (credenciales incluidas, según el proveedor) — queda visible para cualquiera con acceso
              a esta herramienta.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {accion ? "Guardar cambios" : "Crear acción externa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
