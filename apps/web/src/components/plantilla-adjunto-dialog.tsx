"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearPlantillaAdjuntoAction, actualizarPlantillaAdjuntoAction } from "@/app/dashboard/plantillas-adjuntos/actions";

interface PlantillaRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

interface PlantillaAdjuntoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantilla: PlantillaRow | null;
  onGuardado: () => void;
}

// key={plantilla?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function PlantillaAdjuntoDialog({ open, onOpenChange, plantilla, onGuardado }: PlantillaAdjuntoDialogProps) {
  const [codigo, setCodigo] = useState(plantilla?.codigo ?? "");
  const [nombre, setNombre] = useState(plantilla?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(plantilla?.descripcion ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = plantilla
      ? await actualizarPlantillaAdjuntoAction(plantilla.id, { codigo, nombre, descripcion: descripcion || null })
      : await crearPlantillaAdjuntoAction(
          (() => {
            const fd = new FormData();
            fd.set("codigo", codigo);
            fd.set("nombre", nombre);
            fd.set("descripcion", descripcion);
            if (file) fd.set("file", file);
            return fd;
          })(),
        );

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onGuardado();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plantilla ? "Editar Plantilla" : "Nueva Plantilla"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="codigo" className="text-xs uppercase tracking-wider text-muted-foreground">
                Código
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
            <Label htmlFor="descripcion" className="text-xs uppercase tracking-wider text-muted-foreground">
              Descripción
            </Label>
            <Input id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          {!plantilla && (
            <div className="space-y-1.5">
              <Label htmlFor="file" className="text-xs uppercase tracking-wider text-muted-foreground">
                Archivo HTML
              </Label>
              <input
                id="file"
                type="file"
                accept=".html"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium"
              />
              <p className="text-xs text-muted-foreground">
                Después de crearla, para reemplazar el archivo abrí la plantilla desde el listado.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {plantilla ? "Guardar cambios" : "Crear plantilla"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
