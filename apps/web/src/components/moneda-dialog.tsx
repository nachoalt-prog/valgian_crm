"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MonedaInput } from "@valgian/core";

interface MonedaRow {
  id: string;
  codigo: string;
  nombre: string;
  codigoApi: string | null;
}

interface MonedaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moneda: MonedaRow | null;
  onSave: (data: MonedaInput, id?: string) => Promise<{ error?: string } | void>;
}

// key={moneda?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function MonedaDialog({ open, onOpenChange, moneda, onSave }: MonedaDialogProps) {
  const [codigo, setCodigo] = useState(moneda?.codigo ?? "");
  const [nombre, setNombre] = useState(moneda?.nombre ?? "");
  const [codigoApi, setCodigoApi] = useState(moneda?.codigoApi ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave({ codigo, nombre, codigoApi: codigoApi.trim() || null }, moneda?.id);
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
          <DialogTitle>{moneda ? "Editar Moneda" : "Nueva Moneda"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="codigo" className="text-xs uppercase tracking-wider text-muted-foreground">
                Código
              </Label>
              <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ej. USD_CRIPTO" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nombre" className="text-xs uppercase tracking-wider text-muted-foreground">
                Nombre
              </Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="ej. Dólar Cripto" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="codigoApi" className="text-xs uppercase tracking-wider text-muted-foreground">
              Código API
            </Label>
            <Input id="codigoApi" value={codigoApi} onChange={(e) => setCodigoApi(e.target.value)} placeholder="ej. cripto" className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">
              Identificador con el que la fuente externa (hoy, DolarApi) reconoce este registro — se arma como{" "}
              <code className="font-mono">https://dolarapi.com/v1/dolares/{"{código API}"}</code>. Vacío = no se consulta ninguna API para esta
              moneda (ej. el peso).
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {moneda ? "Guardar cambios" : "Crear moneda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
