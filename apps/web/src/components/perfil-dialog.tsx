"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PerfilConContador } from "@valgian/core";

interface InterfazOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface PerfilDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perfil: PerfilConContador | null;
  interfaces: InterfazOption[];
  onSave: (data: { codigo: string; nombre: string; idInterfaz: string | null }, id?: string) => Promise<{ error?: string } | void>;
}

// key={perfil?.id ?? "new"} en el padre fuerza un remount al cambiar de registro,
// así el estado arranca limpio sin necesitar un useEffect que lo resetee.
export function PerfilDialog({ open, onOpenChange, perfil, interfaces, onSave }: PerfilDialogProps) {
  const [codigo, setCodigo] = useState(perfil?.codigo ?? "");
  const [nombre, setNombre] = useState(perfil?.nombre ?? "");
  const [idInterfaz, setIdInterfaz] = useState<string | null>(perfil?.idInterfaz ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave({ codigo, nombre, idInterfaz }, perfil?.id);
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
          <DialogTitle>{perfil ? "Editar Perfil" : "Nuevo Perfil"}</DialogTitle>
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
            <Label htmlFor="idInterfaz" className="text-xs uppercase tracking-wider text-muted-foreground">
              Interfaz
            </Label>
            <Select
              items={Object.fromEntries(interfaces.map((i) => [i.id, `[${i.codigo}] ${i.nombre}`]))}
              value={idInterfaz ?? undefined}
              onValueChange={(v) => setIdInterfaz(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin interfaz asignada" />
              </SelectTrigger>
              <SelectContent>
                {interfaces.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    [{i.codigo}] {i.nombre}
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
              {perfil ? "Guardar cambios" : "Crear perfil"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
