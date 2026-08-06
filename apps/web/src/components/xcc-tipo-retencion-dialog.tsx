"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TipoRetencionInput } from "@valgian/module-cuenta-corriente";
import type { TipoRetencionRow } from "@/components/xcc-tipos-retencion-tool";

interface XccTipoRetencionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoRetencionRow | null;
  onSave: (data: TipoRetencionInput, id?: string) => Promise<{ error?: string } | void>;
}

// key={tipo?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function XccTipoRetencionDialog({ open, onOpenChange, tipo, onSave }: XccTipoRetencionDialogProps) {
  const [codigo, setCodigo] = useState(tipo?.codigo ?? "");
  const [nombre, setNombre] = useState(tipo?.nombre ?? "");
  const [orden, setOrden] = useState(String(tipo?.orden ?? 1));
  const [activa, setActiva] = useState(tipo?.activa ?? false);
  const [alicuota, setAlicuota] = useState(String(tipo?.alicuota ?? 0));
  const [usaCondicionImpositiva, setUsaCondicionImpositiva] = useState(tipo?.usaCondicionImpositiva ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const ordenNum = Number(orden);
    const alicuotaNum = Number(alicuota);
    if (!codigo.trim() || !nombre.trim() || Number.isNaN(ordenNum) || Number.isNaN(alicuotaNum)) {
      setError("Completá código, nombre, orden y alícuota (numéricos).");
      return;
    }

    setPending(true);
    const result = await onSave(
      { codigo: codigo.trim(), nombre, orden: ordenNum, activa, alicuota: alicuotaNum, usaCondicionImpositiva },
      tipo?.id,
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
          <DialogTitle>{tipo ? "Editar Tipo de Retención" : "Nuevo Tipo de Retención"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="codigo" className="text-xs uppercase tracking-wider text-muted-foreground">
                Código
              </Label>
              <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ej. iva" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orden" className="text-xs uppercase tracking-wider text-muted-foreground">
                Orden
              </Label>
              <Input id="orden" type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre" className="text-xs uppercase tracking-wider text-muted-foreground">
              Nombre
            </Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="ej. IVA sobre intereses" />
          </div>

          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} className="size-4 accent-primary" />
            <span className="text-sm text-foreground">Activa (el motor la aplica en la próxima acreditación)</span>
          </label>

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={usaCondicionImpositiva}
              onChange={(e) => setUsaCondicionImpositiva(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="text-sm text-foreground">Alícuota por condición impositiva del cliente</span>
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="alicuota" className="text-xs uppercase tracking-wider text-muted-foreground">
              Alícuota (%){usaCondicionImpositiva && " — default"}
            </Label>
            <Input id="alicuota" type="number" step="0.01" value={alicuota} onChange={(e) => setAlicuota(e.target.value)} />
          </div>
          {usaCondicionImpositiva && (
            <p className="text-xs text-muted-foreground">
              Se usa como default cuando la condición impositiva del cliente titular no tiene una alícuota propia configurada para este tipo — la
              condición puede pisarlo (ver ABM Condiciones Impositivas).
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {tipo ? "Guardar cambios" : "Crear tipo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
