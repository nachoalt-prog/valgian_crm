"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TipoMovimientoCreateInput, TipoMovimientoUpdateInput } from "@valgian/module-cuenta-corriente";
import type { TipoMovimientoRow } from "@/components/xcc-tipos-movimiento-tool";

interface XccTipoMovimientoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoMovimientoRow | null;
  onSave: (data: TipoMovimientoCreateInput | TipoMovimientoUpdateInput, id?: string) => Promise<{ error?: string } | void>;
}

const OPCIONES_SIGNO = { "1": "Suma al capital (+1)", "-1": "Resta del capital (−1)" };

// key={tipo?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function XccTipoMovimientoDialog({ open, onOpenChange, tipo, onSave }: XccTipoMovimientoDialogProps) {
  const [codigo, setCodigo] = useState(tipo?.codigo ?? "");
  const [nombre, setNombre] = useState(tipo?.nombre ?? "");
  const [signo, setSigno] = useState(tipo?.signo === -1 ? "-1" : "1");
  const [afectaCapital, setAfectaCapital] = useState(tipo?.afectaCapital ?? true);
  const [orden, setOrden] = useState(String(tipo?.orden ?? 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const ordenNum = Number(orden);
    if (!nombre.trim() || Number.isNaN(ordenNum)) {
      setError("Completá nombre y orden (numérico).");
      return;
    }
    if (!tipo && !codigo.trim()) {
      setError("El código es obligatorio.");
      return;
    }

    setPending(true);
    const data = tipo
      ? { nombre, signo: Number(signo), afectaCapital, orden: ordenNum }
      : { codigo: codigo.trim(), nombre, signo: Number(signo), afectaCapital, orden: ordenNum };
    const result = await onSave(data, tipo?.id);
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
          <DialogTitle>{tipo ? "Editar Tipo de Movimiento" : "Nuevo Tipo de Movimiento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="codigo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Código
            </Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="ej. cheque_diferido"
              className="font-mono text-sm"
              disabled={!!tipo}
            />
            {tipo && <p className="text-xs text-muted-foreground">No se puede cambiar después de creado.</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre" className="text-xs uppercase tracking-wider text-muted-foreground">
              Nombre
            </Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="ej. Cheque diferido" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Signo</Label>
              <Select items={OPCIONES_SIGNO} value={signo} onValueChange={(v) => setSigno(v ?? "1")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Suma al capital (+1)</SelectItem>
                  <SelectItem value="-1">Resta del capital (−1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orden" className="text-xs uppercase tracking-wider text-muted-foreground">
                Orden
              </Label>
              <Input id="orden" type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={afectaCapital} onChange={(e) => setAfectaCapital(e.target.checked)} className="size-4 accent-primary" />
            <span className="text-sm text-foreground">Afecta el capital de la cuenta</span>
          </label>

          <p className="text-xs text-muted-foreground">
            El motor lee Signo/Afecta Capital/Orden en tiempo real — cambiarlos en un tipo ya usado altera cálculos reales la próxima vez que se recalcule
            una cuenta.
          </p>

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
