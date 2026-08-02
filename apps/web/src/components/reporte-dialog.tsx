"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReporteInput } from "@valgian/core";

interface ReporteRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  idCategoria: string | null;
  query: string | null;
  columnas: unknown;
}

interface CategoriaOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface ReporteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reporte: ReporteRow | null;
  categorias: CategoriaOption[];
  onSave: (data: ReporteInput, id?: string) => Promise<{ error?: string } | void>;
}

// key={reporte?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function ReporteDialog({ open, onOpenChange, reporte, categorias, onSave }: ReporteDialogProps) {
  const [codigo, setCodigo] = useState(reporte?.codigo ?? "");
  const [nombre, setNombre] = useState(reporte?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(reporte?.descripcion ?? "");
  const [idCategoria, setIdCategoria] = useState<string | null>(reporte?.idCategoria ?? null);
  const [query, setQuery] = useState(reporte?.query ?? "");
  const [columnasTexto, setColumnasTexto] = useState(reporte?.columnas ? JSON.stringify(reporte.columnas, null, 2) : "[]");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!idCategoria) {
      setError("Elegí una categoría.");
      return;
    }

    let columnas: unknown;
    try {
      columnas = JSON.parse(columnasTexto);
    } catch {
      setError('Columnas no es JSON válido — ej. [{"campo":"estado","label":"Estado"}]');
      return;
    }

    setPending(true);
    const result = await onSave({ codigo, nombre, descripcion: descripcion || null, idCategoria, query, columnas }, reporte?.id);
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
          <DialogTitle>{reporte ? "Editar Reporte" : "Nuevo Reporte"}</DialogTitle>
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
            <Label htmlFor="descripcion" className="text-xs uppercase tracking-wider text-muted-foreground">
              Descripción
            </Label>
            <Input id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Categoría</Label>
            <Select
              items={Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))}
              value={idCategoria ?? undefined}
              onValueChange={(v) => setIdCategoria(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná una categoría…" />
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

          <div className="space-y-1.5">
            <Label htmlFor="query" className="text-xs uppercase tracking-wider text-muted-foreground">
              Query base (SQL con alias — ver domain/reportes.md)
            </Label>
            <textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={8}
              required
              placeholder='SELECT G."ID" AS id, G."ESTADO" AS estado, ... FROM "GENERACIONES_DOCUMENTO" G ...'
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
              placeholder='[{"campo": "estado", "label": "Estado", "tipo": "badge"}, {"campo": "alta_fecha", "label": "Fecha", "tipo": "fecha"}]'
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {reporte ? "Guardar cambios" : "Crear reporte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
