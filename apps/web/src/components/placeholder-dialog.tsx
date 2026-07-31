"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlaceholderInput } from "@valgian/core";

interface PlaceholderRow {
  id: string;
  codigo: string;
  nombre: string;
  query: string | null;
  escapar: boolean | null;
}

interface PlaceholderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder: PlaceholderRow | null;
  onSave: (data: PlaceholderInput, id?: string) => Promise<{ error?: string } | void>;
}

// key={placeholder?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function PlaceholderDialog({ open, onOpenChange, placeholder, onSave }: PlaceholderDialogProps) {
  const [codigo, setCodigo] = useState(placeholder?.codigo ?? "");
  const [nombre, setNombre] = useState(placeholder?.nombre ?? "");
  const [query, setQuery] = useState(placeholder?.query ?? "");
  const [escapar, setEscapar] = useState(placeholder?.escapar !== false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave({ codigo, nombre, query: query || null, escapar }, placeholder?.id);
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
          <DialogTitle>{placeholder ? "Editar Placeholder" : "Nuevo Placeholder"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="codigo" className="text-xs uppercase tracking-wider text-muted-foreground">
                Código (se busca como ##CODIGO##)
              </Label>
              <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} required className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nombre" className="text-xs uppercase tracking-wider text-muted-foreground">
                Nombre
              </Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="query" className="text-xs uppercase tracking-wider text-muted-foreground">
              Query (SQL — recibe $1::jsonb con los datos raíz, devuelve un valor escalar)
            </Label>
            <textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={6}
              placeholder={`SELECT ($1::jsonb->>'campo')::text AS valor`}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={escapar} onChange={(e) => setEscapar(e.target.checked)} className="size-4 accent-primary" />
            <span className="text-sm text-foreground">Escapar el resultado (desmarcar solo si la query devuelve HTML de confianza, ej. una tabla)</span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {placeholder ? "Guardar cambios" : "Crear placeholder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
