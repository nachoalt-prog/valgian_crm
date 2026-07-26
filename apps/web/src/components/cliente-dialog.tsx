"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClienteInput } from "@valgian/core";

interface Opcion {
  id: string;
  codigo: string;
  nombre: string;
}

interface ClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idLegajo: string;
  caracteres: Opcion[];
  tiposDocumento: Opcion[];
  generos: Opcion[];
  onSave: (data: ClienteInput) => Promise<{ error?: string } | void>;
}

export function ClienteDialog({ open, onOpenChange, idLegajo, caracteres, tiposDocumento, generos, onSave }: ClienteDialogProps) {
  const [apellido, setApellido] = useState("");
  const [nombre, setNombre] = useState("");
  const [idCaracter, setIdCaracter] = useState<string | null>(null);
  const [idTipoDocumento, setIdTipoDocumento] = useState<string | null>(null);
  const [nroDocumento, setNroDocumento] = useState("");
  const [idGenero, setIdGenero] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave({
      idLegajo,
      idCaracter,
      esTitular: false,
      idTipoDocumento,
      nroDocumento: nroDocumento || null,
      apellido: apellido || null,
      nombre,
      idGenero,
      idProvincia: null,
    });
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setApellido("");
    setNombre("");
    setIdCaracter(null);
    setIdTipoDocumento(null);
    setNroDocumento("");
    setIdGenero(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Cliente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Apellido</Label>
              <Input value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Carácter</Label>
            <Select
              items={Object.fromEntries(caracteres.map((c) => [c.id, c.nombre]))}
              value={idCaracter ?? undefined}
              onValueChange={(v) => setIdCaracter(v ?? null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná…" />
              </SelectTrigger>
              <SelectContent>
                {caracteres.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo Documento</Label>
              <Select
                items={Object.fromEntries(tiposDocumento.map((t) => [t.id, t.nombre]))}
                value={idTipoDocumento ?? undefined}
                onValueChange={(v) => setIdTipoDocumento(v ?? null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccioná…" />
                </SelectTrigger>
                <SelectContent>
                  {tiposDocumento.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nro. Documento</Label>
              <Input value={nroDocumento} onChange={(e) => setNroDocumento(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Género</Label>
            <Select
              items={Object.fromEntries(generos.map((g) => [g.id, g.nombre]))}
              value={idGenero ?? undefined}
              onValueChange={(v) => setIdGenero(v ?? null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná…" />
              </SelectTrigger>
              <SelectContent>
                {generos.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nombre}
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
              Crear cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
