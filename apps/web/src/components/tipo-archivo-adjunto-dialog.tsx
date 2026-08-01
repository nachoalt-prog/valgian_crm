"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TipoArchivoAdjuntoInput } from "@valgian/core";

interface TipoArchivoAdjuntoRow {
  id: string;
  codigo: string;
  nombre: string;
  extension: string | null;
  mimetype: string | null;
  permiteCarga: boolean | null;
  permiteDownload: boolean | null;
  renderizar: boolean | null;
}

interface TipoArchivoAdjuntoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoArchivoAdjuntoRow | null;
  onSave: (data: TipoArchivoAdjuntoInput, id?: string) => Promise<{ error?: string } | void>;
}

// key={tipo?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function TipoArchivoAdjuntoDialog({ open, onOpenChange, tipo, onSave }: TipoArchivoAdjuntoDialogProps) {
  const [codigo, setCodigo] = useState(tipo?.codigo ?? "");
  const [nombre, setNombre] = useState(tipo?.nombre ?? "");
  const [extension, setExtension] = useState(tipo?.extension ?? "");
  const [mimetype, setMimetype] = useState(tipo?.mimetype ?? "");
  const [permiteCarga, setPermiteCarga] = useState(tipo?.permiteCarga ?? false);
  const [permiteDownload, setPermiteDownload] = useState(tipo?.permiteDownload ?? false);
  const [renderizar, setRenderizar] = useState(tipo?.renderizar ?? false);
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
        extension: extension.trim() || null,
        mimetype: mimetype.trim() || null,
        permiteCarga,
        permiteDownload,
        renderizar,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tipo ? "Editar Tipo de Adjunto" : "Nuevo Tipo de Adjunto"}</DialogTitle>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="extension" className="text-xs uppercase tracking-wider text-muted-foreground">
                Extensión
              </Label>
              <Input id="extension" value={extension} onChange={(e) => setExtension(e.target.value)} placeholder="ej. pdf" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mimetype" className="text-xs uppercase tracking-wider text-muted-foreground">
                Mimetype
              </Label>
              <Input id="mimetype" value={mimetype} onChange={(e) => setMimetype(e.target.value)} placeholder="ej. application/pdf" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Un archivo subido se matchea contra el par exacto (Extensión, Mimetype) para saber qué tipo es.
          </p>

          <div className="flex flex-col gap-2.5">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={permiteCarga} onChange={(e) => setPermiteCarga(e.target.checked)} className="size-4 accent-primary" />
              <span className="text-sm text-foreground">Permite carga</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={permiteDownload}
                onChange={(e) => setPermiteDownload(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span className="text-sm text-foreground">Permite descarga</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={renderizar} onChange={(e) => setRenderizar(e.target.checked)} className="size-4 accent-primary" />
              <span className="text-sm text-foreground">Previsualiza (imagen / PDF / HTML)</span>
            </label>
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
