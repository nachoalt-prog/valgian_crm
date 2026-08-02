"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  listPlaceholdersDePlantillaAction,
  listAccionesExternasMensajeriaAction,
  enviarMensajePruebaAction,
  getEstadoMensajePruebaAction,
} from "@/app/dashboard/mensajeria-plantillas/actions";
import type { AccionExternaMensajeriaOption } from "@valgian/core";

interface PlantillaRow {
  id: string;
  nombre: string;
}

interface MensajeriaPlantillaProbarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantilla: PlantillaRow | null;
}

const POLL_MS = 2500;

// key={plantilla?.id} en el padre fuerza un remount al cambiar de registro.
export function MensajeriaPlantillaProbarDialog({ open, onOpenChange, plantilla }: MensajeriaPlantillaProbarDialogProps) {
  const [cargando, setCargando] = useState(true);
  const [codigos, setCodigos] = useState<string[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [acciones, setAcciones] = useState<AccionExternaMensajeriaOption[]>([]);
  const [destino, setDestino] = useState("");
  const [idAccionExterna, setIdAccionExterna] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [idMensajeEnCurso, setIdMensajeEnCurso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ ok: boolean; desc: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open || !plantilla) return;
    let cancelado = false;
    setCargando(true);
    setError(null);

    Promise.all([listPlaceholdersDePlantillaAction(plantilla.id), listAccionesExternasMensajeriaAction()]).then(([placeholdersRes, accionesRes]) => {
      if (cancelado) return;
      if (placeholdersRes.error) {
        setError(placeholdersRes.error);
        setCargando(false);
        return;
      }
      if (accionesRes.error) {
        setError(accionesRes.error);
        setCargando(false);
        return;
      }
      const codigosEncontrados = placeholdersRes.data ?? [];
      setCodigos(codigosEncontrados);
      setValores(Object.fromEntries(codigosEncontrados.map((c) => [c, ""])));
      setAcciones(accionesRes.data ?? []);
      setCargando(false);
    });

    return () => {
      cancelado = true;
    };
  }, [open, plantilla]);

  // Polling — corta solo cuando el mensaje tuvo éxito o agotó reintentos.
  useEffect(() => {
    if (!idMensajeEnCurso) return;

    intervaloRef.current = setInterval(async () => {
      const res = await getEstadoMensajePruebaAction(idMensajeEnCurso);
      if (res.error || !res.data) return;

      const { resultado: r, resultadoDesc, reintentosSuperados } = res.data;
      if (r === 0) {
        setResultado({ ok: true, desc: resultadoDesc ?? "Mensaje enviado con éxito." });
        setIdMensajeEnCurso(null);
        setEnviando(false);
      } else if (reintentosSuperados) {
        setResultado({ ok: false, desc: resultadoDesc ?? "El mensaje falló y se agotaron los reintentos." });
        setIdMensajeEnCurso(null);
        setEnviando(false);
      }
    }, POLL_MS);

    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
    };
  }, [idMensajeEnCurso]);

  async function handleEnviar() {
    if (!plantilla || !idAccionExterna) return;
    setError(null);
    setResultado(null);
    setEnviando(true);

    const result = await enviarMensajePruebaAction({
      idPlantilla: plantilla.id,
      idAccionExterna,
      destino,
      placeholders: valores,
    });

    if (result.error || !result.data) {
      setError(result.error ?? "No se pudo encolar el mensaje.");
      setEnviando(false);
      return;
    }

    setIdMensajeEnCurso(result.data.id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Probar "{plantilla?.nombre}"</DialogTitle>
        </DialogHeader>

        {cargando && <p className="py-4 text-sm text-muted-foreground">Cargando…</p>}

        {!cargando && (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto py-2 pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="destino" className="text-xs uppercase tracking-wider text-muted-foreground">
                Email destino
              </Label>
              <Input id="destino" type="email" value={destino} onChange={(e) => setDestino(e.target.value)} required disabled={enviando} />
            </div>

            {codigos.map((codigo) => (
              <div key={codigo} className="space-y-1.5">
                <Label htmlFor={`ph-${codigo}`} className="text-xs uppercase tracking-wider text-muted-foreground">
                  {codigo}
                </Label>
                <Input
                  id={`ph-${codigo}`}
                  value={valores[codigo] ?? ""}
                  onChange={(e) => setValores((prev) => ({ ...prev, [codigo]: e.target.value }))}
                  disabled={enviando}
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Acción externa</Label>
              <Select
                items={Object.fromEntries(acciones.map((a) => [a.id, a.nombre]))}
                value={idAccionExterna}
                onValueChange={(v) => setIdAccionExterna(v ?? "")}
                disabled={enviando}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí una acción" />
                </SelectTrigger>
                <SelectContent>
                  {acciones.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {acciones.length === 0 && <p className="text-xs text-muted-foreground">No hay acciones externas habilitadas para mensajería.</p>}
            </div>

            {enviando && <p className="text-sm text-muted-foreground">Enviando el mensaje, por favor espere en esta pantalla.</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {resultado && <p className={resultado.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{resultado.desc}</p>}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cerrar
          </Button>
          {enviando ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button type="button" aria-disabled="true" className="cursor-default gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    Enviando
                  </Button>
                }
              />
              <TooltipContent side="top" className="text-xs">
                Enviando..
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button type="button" onClick={handleEnviar} disabled={cargando || !destino || !idAccionExterna} className="gap-1.5">
              <Send className="size-3.5" />
              Enviar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
