"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TipoTramiteInput } from "@valgian/core";
import type { TipoTramiteRow, OpcionSimple } from "@/components/tipos-tramite-admin-tool";

interface TipoTramiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoTramiteRow | null;
  categorias: OpcionSimple[];
  estrategias: OpcionSimple[];
  entidades: OpcionSimple[];
  onSave: (data: TipoTramiteInput, id?: string) => Promise<{ error?: string } | void>;
}

// key={tipo?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function TipoTramiteDialog({ open, onOpenChange, tipo, categorias, estrategias, entidades, onSave }: TipoTramiteDialogProps) {
  const [codigo, setCodigo] = useState(tipo?.codigo ?? "");
  const [nombre, setNombre] = useState(tipo?.nombre ?? "");
  const [idCategoria, setIdCategoria] = useState<string | null>(tipo?.idCategoria ?? null);
  const [idEstrategia, setIdEstrategia] = useState<string | null>(tipo?.idEstrategia ?? null);
  const [idEntidad, setIdEntidad] = useState<string | null>(tipo?.idEntidad ?? null);
  const [filtro, setFiltro] = useState(tipo?.filtro ?? "");
  const [componente, setComponente] = useState(tipo?.componente ?? "");
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
        idCategoria,
        idEstrategia,
        idEntidad,
        filtro: filtro.trim() || null,
        componente: componente.trim() || null,
      },
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tipo ? "Editar Tipo de Trámite" : "Nuevo Tipo de Trámite"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Categoría</Label>
            <Select
              items={Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))}
              value={idCategoria ?? undefined}
              onValueChange={(v) => setIdCategoria(v ?? null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin categoría…" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Estrategia</Label>
              <Select
                items={Object.fromEntries(estrategias.map((e) => [e.id, e.nombre]))}
                value={idEstrategia ?? undefined}
                onValueChange={(v) => setIdEstrategia(v ?? null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin estrategia…" />
                </SelectTrigger>
                <SelectContent>
                  {estrategias.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Entidad</Label>
              <Select
                items={Object.fromEntries(entidades.map((e) => [e.id, e.nombre]))}
                value={idEntidad ?? undefined}
                onValueChange={(v) => setIdEntidad(v ?? null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin entidad…" />
                </SelectTrigger>
                <SelectContent>
                  {entidades.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro" className="text-xs uppercase tracking-wider text-muted-foreground">
              Filtro (función SQL de confianza)
            </Label>
            <Input id="filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="fn(uuid[]) RETURNS uuid[] — opcional" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="componente" className="text-xs uppercase tracking-wider text-muted-foreground">
              Componente custom
            </Label>
            <Input id="componente" value={componente} onChange={(e) => setComponente(e.target.value)} placeholder="Vacío = autodibujado (default)" />
          </div>

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
