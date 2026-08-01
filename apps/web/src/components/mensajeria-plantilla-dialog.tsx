"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearMensajeriaPlantillaAction, actualizarMensajeriaPlantillaAction } from "@/app/dashboard/mensajeria-plantillas/actions";
import type { EstimuloConEstrategia } from "@valgian/core";

interface PlantillaRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  asunto: string | null;
  idEstimuloOk: string | null;
  observacionOk: string | null;
  idEstimuloError: string | null;
  observacionError: string | null;
}

interface MensajeriaPlantillaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantilla: PlantillaRow | null;
  estimulosDisponibles: EstimuloConEstrategia[];
  onGuardado: () => void;
}

const SIN_ESTIMULO = "__sin_estimulo__";

// key={plantilla?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function MensajeriaPlantillaDialog({ open, onOpenChange, plantilla, estimulosDisponibles, onGuardado }: MensajeriaPlantillaDialogProps) {
  const [codigo, setCodigo] = useState(plantilla?.codigo ?? "");
  const [nombre, setNombre] = useState(plantilla?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(plantilla?.descripcion ?? "");
  const [asunto, setAsunto] = useState(plantilla?.asunto ?? "");
  const [idEstimuloOk, setIdEstimuloOk] = useState(plantilla?.idEstimuloOk ?? SIN_ESTIMULO);
  const [observacionOk, setObservacionOk] = useState(plantilla?.observacionOk ?? "");
  const [idEstimuloError, setIdEstimuloError] = useState(plantilla?.idEstimuloError ?? SIN_ESTIMULO);
  const [observacionError, setObservacionError] = useState(plantilla?.observacionError ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const itemsEstimulos = {
    [SIN_ESTIMULO]: "Ninguno",
    ...Object.fromEntries(estimulosDisponibles.map((e) => [e.id, `${e.estrategiaNombre ?? "—"} / ${e.nombre}`])),
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const datosComunes = {
      codigo,
      nombre,
      descripcion: descripcion || null,
      asunto: asunto || null,
      idEstimuloOk: idEstimuloOk === SIN_ESTIMULO ? null : idEstimuloOk,
      observacionOk: observacionOk || null,
      idEstimuloError: idEstimuloError === SIN_ESTIMULO ? null : idEstimuloError,
      observacionError: observacionError || null,
    };

    const result = plantilla
      ? await actualizarMensajeriaPlantillaAction(plantilla.id, datosComunes)
      : await crearMensajeriaPlantillaAction(
          (() => {
            const fd = new FormData();
            for (const [key, value] of Object.entries(datosComunes)) {
              if (value !== null) fd.set(key, value);
            }
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
          <DialogTitle>{plantilla ? "Editar Plantilla de Mensajería" : "Nueva Plantilla de Mensajería"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto py-2 pr-1">
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

          <div className="space-y-1.5">
            <Label htmlFor="asunto" className="text-xs uppercase tracking-wider text-muted-foreground">
              Asunto
            </Label>
            <Input id="asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="ej. Bienvenido a ##demo_nombre_cliente##" />
            <p className="text-xs text-muted-foreground">Admite ##CODIGO## — se resuelve con el mismo motor de Placeholders que el cuerpo.</p>
          </div>

          {!plantilla && (
            <div className="space-y-1.5">
              <Label htmlFor="file" className="text-xs uppercase tracking-wider text-muted-foreground">
                Archivo HTML (cuerpo del mensaje)
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

          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Al enviar con éxito</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estímulo</Label>
              <Select items={itemsEstimulos} value={idEstimuloOk} onValueChange={(v) => setIdEstimuloOk(v ?? SIN_ESTIMULO)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(itemsEstimulos).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="observacionOk" className="text-xs text-muted-foreground">
                Observación
              </Label>
              <Input id="observacionOk" value={observacionOk} onChange={(e) => setObservacionOk(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Al agotar los reintentos en error</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estímulo</Label>
              <Select items={itemsEstimulos} value={idEstimuloError} onValueChange={(v) => setIdEstimuloError(v ?? SIN_ESTIMULO)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(itemsEstimulos).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="observacionError" className="text-xs text-muted-foreground">
                Observación
              </Label>
              <Input id="observacionError" value={observacionError} onChange={(e) => setObservacionError(e.target.value)} />
            </div>
          </div>

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
