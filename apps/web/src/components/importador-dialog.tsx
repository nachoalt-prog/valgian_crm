"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ImportadorInput } from "@valgian/core";
import type { ImportadorRow } from "@/components/importadores-tool";

const MODO_ERROR_ITEMS: Record<string, string> = {
  abortar: "Abortar toda la corrida",
  importar_validas: "Importar las filas válidas, saltear el resto",
};

interface ImportadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importador: ImportadorRow | null;
  onSave: (data: ImportadorInput, id?: string) => Promise<{ error?: string } | void>;
}

function vacioANull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

// key={importador?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function ImportadorDialog({ open, onOpenChange, importador, onSave }: ImportadorDialogProps) {
  const [codigo, setCodigo] = useState(importador?.codigo ?? "");
  const [nombre, setNombre] = useState(importador?.nombre ?? "");
  const [tablaStaging, setTablaStaging] = useState(importador?.tablaStaging ?? "");
  const [spNombre, setSpNombre] = useState(importador?.spNombre ?? "");
  const [extensionesPermitidas, setExtensionesPermitidas] = useState(importador?.extensionesPermitidas ?? "csv");
  const [activo, setActivo] = useState(importador?.activo ?? true);
  const [rutaDirectorio, setRutaDirectorio] = useState(importador?.rutaDirectorio ?? "");
  const [patronNombreArchivo, setPatronNombreArchivo] = useState(importador?.patronNombreArchivo ?? "");
  const [disparoAutomaticoActivo, setDisparoAutomaticoActivo] = useState(importador?.disparoAutomaticoActivo ?? false);
  const [modoErrorAutomatico, setModoErrorAutomatico] = useState(importador?.modoErrorAutomatico ?? "abortar");
  const [tablaHistorico, setTablaHistorico] = useState(importador?.tablaHistorico ?? "");
  const [diasRetencionHistorico, setDiasRetencionHistorico] = useState(
    importador?.diasRetencionHistorico != null ? String(importador.diasRetencionHistorico) : "",
  );
  const [carpetaDestinoProcesados, setCarpetaDestinoProcesados] = useState(importador?.carpetaDestinoProcesados ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!codigo.trim() || !nombre.trim() || !tablaStaging.trim() || !spNombre.trim() || !extensionesPermitidas.trim()) {
      setError("Completá código, nombre, tabla de staging, SP y extensiones permitidas.");
      return;
    }
    if (disparoAutomaticoActivo && !rutaDirectorio.trim()) {
      setError("El disparo automático necesita una ruta de directorio configurada.");
      return;
    }
    const diasNum = diasRetencionHistorico.trim() === "" ? null : Number(diasRetencionHistorico);
    if (diasNum !== null && Number.isNaN(diasNum)) {
      setError("Días de retención debe ser un número.");
      return;
    }

    setPending(true);
    const result = await onSave(
      {
        codigo: codigo.trim(),
        nombre,
        tablaStaging: tablaStaging.trim(),
        spNombre: spNombre.trim(),
        extensionesPermitidas: extensionesPermitidas.trim(),
        rutaDirectorio: vacioANull(rutaDirectorio),
        patronNombreArchivo: vacioANull(patronNombreArchivo),
        tablaHistorico: vacioANull(tablaHistorico),
        diasRetencionHistorico: diasNum,
        carpetaDestinoProcesados: vacioANull(carpetaDestinoProcesados),
        disparoAutomaticoActivo,
        modoErrorAutomatico: disparoAutomaticoActivo ? modoErrorAutomatico : null,
        activo,
      },
      importador?.id,
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{importador ? "Editar Importador" : "Nuevo Importador"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="codigo" className="text-xs uppercase tracking-wider text-muted-foreground">
                Código
              </Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="ej. legajos_clientes"
                className="font-mono text-sm"
                disabled={!!importador}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nombre" className="text-xs uppercase tracking-wider text-muted-foreground">
                Nombre
              </Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
          </div>
          {importador && <p className="text-xs text-muted-foreground">El código no se edita después de creado — lo usa el registro de cargadores (ver domain/importadores.md).</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tablaStaging" className="text-xs uppercase tracking-wider text-muted-foreground">
                Tabla de staging
              </Label>
              <Input id="tablaStaging" value={tablaStaging} onChange={(e) => setTablaStaging(e.target.value)} className="font-mono text-sm" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spNombre" className="text-xs uppercase tracking-wider text-muted-foreground">
                SP validar/impactar
              </Label>
              <Input id="spNombre" value={spNombre} onChange={(e) => setSpNombre(e.target.value)} className="font-mono text-sm" required />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Deben existir de antemano (tabla + PROCEDURE) — el motor los resuelve dinámicamente, no los crea.</p>

          <div className="space-y-1.5">
            <Label htmlFor="extensiones" className="text-xs uppercase tracking-wider text-muted-foreground">
              Extensiones permitidas
            </Label>
            <Input id="extensiones" value={extensionesPermitidas} onChange={(e) => setExtensionesPermitidas(e.target.value)} placeholder="csv,xlsx" className="font-mono text-sm" required />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <Label htmlFor="activo" className="text-sm font-normal">
              Activo
            </Label>
            <Switch id="activo" checked={activo} onCheckedChange={setActivo} />
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="disparoAuto" className="text-sm font-normal">
                Disparo automático (por proceso o botón &quot;Correr ahora&quot;)
              </Label>
              <Switch id="disparoAuto" checked={disparoAutomaticoActivo} onCheckedChange={setDisparoAutomaticoActivo} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rutaDirectorio" className="text-xs text-muted-foreground">
                Ruta de directorio
              </Label>
              <Input id="rutaDirectorio" value={rutaDirectorio} onChange={(e) => setRutaDirectorio(e.target.value)} placeholder="ej. imports/legajos" className="font-mono text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="patron" className="text-xs text-muted-foreground">
                Patrón de nombre de archivo (opcional)
              </Label>
              <Input id="patron" value={patronNombreArchivo} onChange={(e) => setPatronNombreArchivo(e.target.value)} placeholder="legajos_%.csv (estilo LIKE)" className="font-mono text-sm" />
            </div>

            {disparoAutomaticoActivo && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Si hay filas con error de validación</Label>
                <Select items={MODO_ERROR_ITEMS} value={modoErrorAutomatico} onValueChange={(v) => setModoErrorAutomatico(v ?? "abortar")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MODO_ERROR_ITEMS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <p className="text-xs text-muted-foreground">Siempre toma el archivo con fecha de modificación más antigua (alfabético como desempate) — sin configuración.</p>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Histórico (opcional)</Label>
            <div className="space-y-1.5">
              <Label htmlFor="tablaHistorico" className="text-xs text-muted-foreground">
                Tabla histórico
              </Label>
              <Input id="tablaHistorico" value={tablaHistorico} onChange={(e) => setTablaHistorico(e.target.value)} className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diasRetencion" className="text-xs text-muted-foreground">
                Días de retención
              </Label>
              <Input id="diasRetencion" type="number" min={0} value={diasRetencionHistorico} onChange={(e) => setDiasRetencionHistorico(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">Sin tabla de histórico, las filas de staging se borran directo. Vacío en días de retención = nunca se limpia solo.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="carpetaDestino" className="text-xs uppercase tracking-wider text-muted-foreground">
              Carpeta destino de archivos procesados (opcional)
            </Label>
            <Input id="carpetaDestino" value={carpetaDestinoProcesados} onChange={(e) => setCarpetaDestinoProcesados(e.target.value)} placeholder="imports/procesados" className="font-mono text-sm" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {importador ? "Guardar cambios" : "Crear importador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
