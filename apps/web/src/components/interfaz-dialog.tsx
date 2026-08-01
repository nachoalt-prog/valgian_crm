"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InterfazRow {
  id: string;
  codigo: string;
  nombre: string;
  fuente: string | null;
  colorPrimario: string | null;
  colorSecundario: string | null;
  titulo: string | null;
  imagenFondo: string | null;
}

interface InterfazDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interfaz: InterfazRow | null;
  onSave: (
    data: {
      codigo: string;
      nombre: string;
      fuente: string | null;
      colorPrimario: string | null;
      colorSecundario: string | null;
      titulo: string | null;
      imagenFondo: string | null;
    },
    id?: string,
  ) => Promise<{ error?: string } | void>;
}

// key={interfaz?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function InterfazDialog({ open, onOpenChange, interfaz, onSave }: InterfazDialogProps) {
  const [codigo, setCodigo] = useState(interfaz?.codigo ?? "");
  const [nombre, setNombre] = useState(interfaz?.nombre ?? "");
  const [fuente, setFuente] = useState(interfaz?.fuente ?? "");
  const [colorPrimario, setColorPrimario] = useState(interfaz?.colorPrimario ?? "");
  const [colorSecundario, setColorSecundario] = useState(interfaz?.colorSecundario ?? "");
  const [titulo, setTitulo] = useState(interfaz?.titulo ?? "");
  const [imagenFondo, setImagenFondo] = useState(interfaz?.imagenFondo ?? "");
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
        fuente: fuente || null,
        colorPrimario: colorPrimario || null,
        colorSecundario: colorSecundario || null,
        titulo: titulo || null,
        imagenFondo: imagenFondo || null,
      },
      interfaz?.id,
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
          <DialogTitle>{interfaz ? "Editar Interfaz" : "Nueva Interfaz"}</DialogTitle>
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
            <Label htmlFor="titulo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Título de marca
            </Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Valgian" />
            <p className="text-xs text-muted-foreground">Se muestra arriba a la izquierda en el menú, en vez de &quot;Valgian&quot;.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fuente" className="text-xs uppercase tracking-wider text-muted-foreground">
              Fuente (layout)
            </Label>
            <Input id="fuente" value={fuente} onChange={(e) => setFuente(e.target.value)} placeholder="default" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="colorPrimario" className="text-xs uppercase tracking-wider text-muted-foreground">
              Color primario
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Elegir color primario"
                value={/^#[0-9A-Fa-f]{6}$/.test(colorPrimario) ? colorPrimario : "#000000"}
                onChange={(e) => setColorPrimario(e.target.value.toUpperCase())}
                className="size-9 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
              />
              <Input
                id="colorPrimario"
                value={colorPrimario}
                onChange={(e) => setColorPrimario(e.target.value)}
                placeholder="#00BFBB"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="colorSecundario" className="text-xs uppercase tracking-wider text-muted-foreground">
              Color secundario
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Elegir color secundario"
                value={/^#[0-9A-Fa-f]{6}$/.test(colorSecundario) ? colorSecundario : "#000000"}
                onChange={(e) => setColorSecundario(e.target.value.toUpperCase())}
                className="size-9 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
              />
              <Input
                id="colorSecundario"
                value={colorSecundario}
                onChange={(e) => setColorSecundario(e.target.value)}
                placeholder="#6C50E9"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="imagenFondo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Imagen de fondo (login)
            </Label>
            <Input
              id="imagenFondo"
              value={imagenFondo}
              onChange={(e) => setImagenFondo(e.target.value)}
              placeholder="https://…"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Solo se ve en la pantalla de login, al 30% de opacidad sobre el color de fondo. Vacío = sin imagen.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {interfaz ? "Guardar cambios" : "Crear interfaz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
