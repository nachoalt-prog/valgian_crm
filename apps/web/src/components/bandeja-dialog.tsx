"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BandejaInput } from "@valgian/core";

interface BandejaRow {
  id: string;
  codigo: string;
  nombre: string;
  query: string | null;
  columnas: unknown;
  idLayout: string | null;
}

interface LayoutOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface BandejaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandeja: BandejaRow | null;
  layoutsDisponibles: LayoutOption[];
  onSave: (data: BandejaInput, id?: string) => Promise<{ error?: string } | void>;
}

const SIN_LAYOUT = "__sin_layout__";

// key={bandeja?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function BandejaDialog({ open, onOpenChange, bandeja, layoutsDisponibles, onSave }: BandejaDialogProps) {
  const [codigo, setCodigo] = useState(bandeja?.codigo ?? "");
  const [nombre, setNombre] = useState(bandeja?.nombre ?? "");
  const [query, setQuery] = useState(bandeja?.query ?? "");
  const [columnasTexto, setColumnasTexto] = useState(bandeja?.columnas ? JSON.stringify(bandeja.columnas, null, 2) : "[]");
  const [idLayout, setIdLayout] = useState(bandeja?.idLayout ?? SIN_LAYOUT);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let columnas: unknown;
    try {
      columnas = JSON.parse(columnasTexto);
    } catch {
      setError('Columnas no es JSON válido — ej. [{"campo":"numero","label":"Nro. Legajo"}]');
      return;
    }

    setPending(true);
    const result = await onSave({ codigo, nombre, query, columnas, idLayout: idLayout === SIN_LAYOUT ? null : idLayout }, bandeja?.id);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{bandeja ? "Editar Bandeja" : "Nueva Bandeja"}</DialogTitle>
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
            <Label htmlFor="query" className="text-xs uppercase tracking-wider text-muted-foreground">
              Query base (SQL con alias — ver domain/bandejas.md)
            </Label>
            <textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={8}
              required
              placeholder='SELECT L."NUMERO" AS numero, ... FROM "LEGAJOS" L ...'
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="columnas" className="text-xs uppercase tracking-wider text-muted-foreground">
              Columnas visibles (JSON — alias de la query, label, tipo opcional)
            </Label>
            <textarea
              id="columnas"
              value={columnasTexto}
              onChange={(e) => setColumnasTexto(e.target.value)}
              rows={6}
              required
              placeholder='[{"campo": "numero", "label": "Nro. Legajo"}, {"campo": "estado", "label": "Estado", "tipo": "badge"}]'
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Layout de legajo (qué se abre al clickear &quot;Abrir&quot; en un resultado)
            </Label>
            <Select
              items={{ [SIN_LAYOUT]: "Ninguno", ...Object.fromEntries(layoutsDisponibles.map((l) => [l.id, l.nombre])) }}
              value={idLayout}
              onValueChange={(v) => setIdLayout(v ?? SIN_LAYOUT)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_LAYOUT}>Ninguno</SelectItem>
                {layoutsDisponibles.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    [{l.codigo}] {l.nombre}
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
              {bandeja ? "Guardar cambios" : "Crear bandeja"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
