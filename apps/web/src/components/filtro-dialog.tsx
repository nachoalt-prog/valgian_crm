"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FiltroInput } from "@valgian/core";

interface FiltroRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string | null;
  query: string | null;
}

const TIPOS: { value: string; label: string }[] = [
  { value: "texto_like", label: "Texto (contiene)" },
  { value: "select", label: "Selección (desplegable)" },
  { value: "fecha", label: "Fecha" },
  { value: "fecha_rango", label: "Rango de fechas" },
];

interface FiltroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filtro: FiltroRow | null;
  onSave: (data: FiltroInput, id?: string) => Promise<{ error?: string } | void>;
}

// key={filtro?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function FiltroDialog({ open, onOpenChange, filtro, onSave }: FiltroDialogProps) {
  const [codigo, setCodigo] = useState(filtro?.codigo ?? "");
  const [nombre, setNombre] = useState(filtro?.nombre ?? "");
  const [tipo, setTipo] = useState(filtro?.tipo ?? "texto_like");
  const [query, setQuery] = useState(filtro?.query ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave({ codigo, nombre, tipo, query: tipo === "select" ? query || null : null }, filtro?.id);
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
          <DialogTitle>{filtro ? "Editar Filtro" : "Nuevo Filtro"}</DialogTitle>
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
                Nombre (label del filtro)
              </Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tipo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Tipo
            </Label>
            <Select
              items={Object.fromEntries(TIPOS.map((t) => [t.value, t.label]))}
              value={tipo}
              onValueChange={(v) => setTipo(v ?? "texto_like")}
            >
              <SelectTrigger id="tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipo === "select" && (
            <div className="space-y-1.5">
              <Label htmlFor="query" className="text-xs uppercase tracking-wider text-muted-foreground">
                Query de opciones (SQL — columnas <code>value</code>/<code>label</code>)
              </Label>
              <textarea
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={4}
                placeholder='SELECT "ID" AS value, "NOMBRE" AS label FROM "..."'
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {filtro ? "Guardar cambios" : "Crear filtro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
