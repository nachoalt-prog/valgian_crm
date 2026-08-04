"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn, handleTabEnTextarea } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HistorialTool } from "@/components/historial-tool";
import { ArchivosAdjuntosTool } from "@/components/archivos-adjuntos-tool";
import {
  getCamposTramiteAction,
  getOpcionesListaValoresAction,
  getValoresParaEditarAction,
  getEstimulosDisponiblesTramiteAction,
  getCabeceraTramiteAction,
  getNumeroTramiteAction,
  gestionarTramiteAction,
  getEntidadTramitesIdAction,
  type DatoCrudoInput,
} from "@/app/dashboard/tramites/actions";
import type { TipoTramiteCampoConTipo } from "@valgian/core";

interface TramiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idTipoTramite: string;
  idRegistro: string;
  idTramite?: string | null;
  canGestionar: boolean;
  onGestionado?: () => void;
}

type Opciones = Record<string, { value: string; label: string }[]>;
type Valores = Record<string, unknown>;

// Copia mínima de packages/core/src/tramites.ts:esValorVacio — un componente
// "use client" no puede importar de @valgian/core (arrastraría el cliente de
// Postgres al bundle del navegador), así que esta regla vive duplicada acá y
// del lado del servidor (gestionarTramiteAction, defensa en profundidad).
function esValorVacio(valor: unknown, codigoTipoCampo: string | null): boolean {
  if (valor === null || valor === undefined || valor === "") return true;
  if (codigoTipoCampo === "SELECT_MULTIPLE") return !Array.isArray(valor) || valor.length === 0;
  if (codigoTipoCampo === "INPUT_CHECKBOX") return valor !== true;
  return false;
}

export function TramiteModal({ open, onOpenChange, idTipoTramite, idRegistro, idTramite, canGestionar, onGestionado }: TramiteModalProps) {
  const [campos, setCampos] = useState<TipoTramiteCampoConTipo[] | null>(null);
  const [valores, setValores] = useState<Valores>({});
  const [opciones, setOpciones] = useState<Opciones>({});
  const [estimulos, setEstimulos] = useState<{ id: string; nombre: string; idEstadoDestino: string }[]>([]);
  const [idEstimulo, setIdEstimulo] = useState<string | null>(null);
  const [observacion, setObservacion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [camposInvalidos, setCamposInvalidos] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"datos" | "historial" | "adjuntos">("datos");
  const [revisionAdjuntos, setRevisionAdjuntos] = useState(0);
  const [idEntidadTramites, setIdEntidadTramites] = useState<string | undefined>(undefined);
  const [cabecera, setCabecera] = useState<{ tipoNombre: string; categoriaNombre: string | null; entidadLabel: string | null } | null>(null);
  const [estadoActual, setEstadoActual] = useState<{ id: string; nombre: string } | null>(null);
  const [numero, setNumero] = useState<string | null>(null);

  // El padre debe montar este componente con una `key` que cambie según
  // (idTipoTramite, idRegistro, idTramite) — así cada trámite distinto arranca
  // con estado limpio por remount, sin necesitar resetear a mano acá adentro.
  useEffect(() => {
    if (!open) return;
    let cancelado = false;

    Promise.all([
      getCamposTramiteAction(idTipoTramite),
      getEstimulosDisponiblesTramiteAction(idTipoTramite, idTramite ?? null),
      idTramite ? getValoresParaEditarAction(idTipoTramite, idTramite) : Promise.resolve({ data: {} as Valores }),
      idTramite ? getEntidadTramitesIdAction() : Promise.resolve({ data: undefined }),
      getCabeceraTramiteAction(idTipoTramite, idRegistro),
      idTramite ? getNumeroTramiteAction(idTramite) : Promise.resolve({ data: null }),
    ]).then(async ([camposRes, estimulosRes, valoresRes, entidadRes, cabeceraRes, numeroRes]) => {
      if (cancelado) return;
      const camposData = camposRes.data ?? [];

      // Se esperan las opciones de SELECT/SELECT_MULTIPLE ANTES de setear nada —
      // si `valores` (con un value ya elegido) se pinta antes de que `opciones`
      // tenga la entrada correspondiente, el Select queda mostrando el value
      // crudo en vez del label y no se recupera solo después.
      const conListaValores = camposData.filter((c) => (c.tipoCampoCodigo === "SELECT" || c.tipoCampoCodigo === "SELECT_MULTIPLE") && c.listaValores);
      const entradas = await Promise.all(
        conListaValores.map(async (c) => [c.id, (await getOpcionesListaValoresAction(c.listaValores!)).data ?? []] as const),
      );
      if (cancelado) return;

      setCampos(camposData);
      setEstimulos(estimulosRes.data?.estimulos ?? []);
      setEstadoActual(estimulosRes.data?.estadoActual ?? null);
      setValores(valoresRes.data ?? {});
      setOpciones(Object.fromEntries(entradas));
      setIdEntidadTramites(entidadRes.data ?? undefined);
      setCabecera(cabeceraRes.data ?? null);
      setNumero(numeroRes.data ?? null);
    });

    return () => {
      cancelado = true;
    };
  }, [open, idTipoTramite, idTramite]);

  function setValor(idCampo: string, valor: unknown) {
    setValores((prev) => ({ ...prev, [idCampo]: valor }));
    setCamposInvalidos((prev) => {
      if (!prev.has(idCampo)) return prev;
      const next = new Set(prev);
      next.delete(idCampo);
      return next;
    });
  }

  function setValorRadio(campo: TipoTramiteCampoConTipo, todosCampos: TipoTramiteCampoConTipo[]) {
    setValores((prev) => {
      const next = { ...prev, [campo.id]: true };
      if (campo.radioGroup !== null) {
        for (const otro of todosCampos) {
          if (otro.id !== campo.id && otro.radioGroup === campo.radioGroup && otro.tipoCampoCodigo === "INPUT_RADIO") {
            next[otro.id] = false;
          }
        }
      }
      return next;
    });
  }

  async function handleGestionar() {
    if (!campos || !idEstimulo) return;
    setError(null);
    setExito(false);

    const faltantes = campos.filter((c) => esObligatorioAhora(c) && esValorVacio(valores[c.id], c.tipoCampoCodigo));
    if (faltantes.length > 0) {
      setCamposInvalidos(new Set(faltantes.map((c) => c.id)));
      setError(`Completá los campos obligatorios: ${faltantes.map((c) => c.nombre).join(", ")}.`);
      return;
    }
    setCamposInvalidos(new Set());
    setPending(true);

    const datosCrudos: DatoCrudoInput[] = campos.map((c) => ({
      idTipoTramiteCampo: c.id,
      codigoTipoCampo: c.tipoCampoCodigo,
      valor: valores[c.id] ?? null,
    }));

    const result = await gestionarTramiteAction({
      idTramite,
      idTipoTramite,
      idRegistro,
      datosCrudos,
      idEstimulo,
      observacion: observacion || null,
    });
    setPending(false);

    if (result?.error) {
      setError(result.error);
      return;
    }
    setExito(true);
    onGestionado?.();
    setTimeout(() => onOpenChange(false), 700);
  }

  // Obligatoriedad condicional al ESTADO_DESTINO del estímulo elegido — sin
  // estímulo seleccionado todavía no hay forma de saber si un campo es
  // obligatorio o no, así que no se marca nada.
  function esObligatorioAhora(campo: TipoTramiteCampoConTipo): boolean {
    const idEstadoDestino = estimulos.find((e) => e.id === idEstimulo)?.idEstadoDestino;
    return !!idEstadoDestino && campo.obligatorioEnEstados.includes(idEstadoDestino);
  }

  function renderCampo(campo: TipoTramiteCampoConTipo, todosCampos: TipoTramiteCampoConTipo[]) {
    const valor = valores[campo.id];
    const disabled = !canGestionar || campo.editable === false;
    const comun = {
      id: campo.id,
      required: esObligatorioAhora(campo),
      disabled,
      placeholder: campo.placeholder ?? undefined,
    };

    switch (campo.tipoCampoCodigo) {
      case "INPUT_TEXT":
      case "INPUT_EMAIL":
      case "INPUT_TEL":
        return (
          <Input
            {...comun}
            type={campo.tipoCampoCodigo === "INPUT_EMAIL" ? "email" : campo.tipoCampoCodigo === "INPUT_TEL" ? "tel" : "text"}
            value={(valor as string) ?? ""}
            maxLength={campo.longitudMax ?? undefined}
            pattern={campo.regex ?? undefined}
            onChange={(e) => setValor(campo.id, e.target.value)}
          />
        );
      case "INPUT_DATETIME":
        return (
          <Input
            {...comun}
            type="datetime-local"
            value={(valor as string) ?? ""}
            onChange={(e) => setValor(campo.id, e.target.value)}
          />
        );
      case "INPUT_NUMBER":
        return (
          <Input
            {...comun}
            type="number"
            value={(valor as number) ?? ""}
            min={campo.numMin ?? undefined}
            max={campo.numMax ?? undefined}
            step={campo.numStep ?? undefined}
            onChange={(e) => setValor(campo.id, e.target.value === "" ? null : Number(e.target.value))}
          />
        );
      case "INPUT_RANGE":
        return (
          <div className="flex items-center gap-3">
            <input
              id={campo.id}
              type="range"
              disabled={disabled}
              min={campo.numMin ?? 0}
              max={campo.numMax ?? 100}
              step={campo.numStep ?? 1}
              value={(valor as number) ?? campo.numMin ?? 0}
              onChange={(e) => setValor(campo.id, Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="w-10 text-right text-sm text-muted-foreground">{(valor as number) ?? campo.numMin ?? 0}</span>
          </div>
        );
      case "INPUT_CHECKBOX":
        return (
          <label className={`flex items-center gap-2.5 ${disabled ? "" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={(valor as boolean) ?? false}
              disabled={disabled}
              onChange={(e) => setValor(campo.id, e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="text-sm text-foreground">{(valor as boolean) ? "Sí" : "No"}</span>
          </label>
        );
      case "INPUT_RADIO":
        return (
          <label className={`flex items-center gap-2.5 ${disabled ? "" : "cursor-pointer"}`}>
            <input
              type="radio"
              checked={(valor as boolean) ?? false}
              disabled={disabled}
              onChange={() => setValorRadio(campo, todosCampos)}
              className="size-4 accent-primary"
            />
            <span className="text-sm text-foreground">{campo.nombre}</span>
          </label>
        );
      case "SELECT": {
        const opcionesCampo = opciones[campo.id] ?? [];
        return (
          <Select
            items={Object.fromEntries(opcionesCampo.map((o) => [o.value, o.label]))}
            value={(valor as string) ?? undefined}
            onValueChange={(v) => setValor(campo.id, v ?? null)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccioná…" />
            </SelectTrigger>
            <SelectContent>
              {opcionesCampo.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      case "SELECT_MULTIPLE": {
        const opcionesCampo = opciones[campo.id] ?? [];
        const seleccionados = new Set((valor as string[] | undefined) ?? []);
        return (
          <div className="flex flex-col gap-1.5">
            {opcionesCampo.map((o) => (
              <label key={o.value} className={`flex items-center gap-2.5 ${disabled ? "" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  checked={seleccionados.has(o.value)}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = new Set(seleccionados);
                    if (e.target.checked) next.add(o.value);
                    else next.delete(o.value);
                    setValor(campo.id, Array.from(next));
                  }}
                  className="size-4 accent-primary"
                />
                <span className="text-sm text-foreground">{o.label}</span>
              </label>
            ))}
          </div>
        );
      }
      case "FILE":
        return <p className="text-sm text-muted-foreground italic">Adjuntar archivos: disponible en una próxima etapa.</p>;
      default:
        return <Input {...comun} value={(valor as string) ?? ""} onChange={(e) => setValor(campo.id, e.target.value)} />;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-5xl! flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>{idTramite ? "Gestionar Trámite" : "Iniciar Trámite"}</DialogTitle>
        </DialogHeader>

        {/* Cabecera fija tipo-ticket — visible sin importar la solapa activa. */}
        <div className="flex shrink-0 flex-wrap gap-x-6 gap-y-1.5 border-b border-border bg-muted/30 px-5 py-2.5 text-xs">
          <span>
            <span className="text-muted-foreground">Tipo: </span>
            <span className="font-medium text-foreground">{cabecera?.tipoNombre ?? "—"}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Categoría: </span>
            <span className="font-medium text-foreground">{cabecera?.categoriaNombre ?? "—"}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Entidad: </span>
            <span className="font-medium text-foreground">{cabecera?.entidadLabel ?? "—"}</span>
          </span>
          <span>
            <span className="text-muted-foreground">N°: </span>
            <span className="font-mono font-medium text-foreground">{numero ?? "(nuevo)"}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Estado: </span>
            <span className="font-medium text-foreground">{estadoActual?.nombre ?? "—"}</span>
          </span>
        </div>

        {/* Sin idTramite (alta nueva) no hay historial que mostrar todavía. */}
        {idTramite && (
          <div className="flex shrink-0 gap-1 border-b border-border px-5 pt-3">
            {(["datos", "historial", "adjuntos"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "-mb-px rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium capitalize transition-colors",
                  activeTab === tab
                    ? "border-border bg-popover text-foreground"
                    : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/60",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {campos === null ? (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <div className={cn("flex flex-1 gap-6 overflow-y-auto p-5", activeTab !== "datos" && "hidden")}>
            <div className="flex-1 space-y-4">
              {campos.length === 0 && <p className="text-sm text-muted-foreground">Este tipo de trámite no tiene campos configurados.</p>}
              {campos
                .filter((c) => c.visible !== false)
                .map((campo) => (
                  <div key={campo.id} className="space-y-1.5">
                    <Label className={cn("text-xs uppercase tracking-wider", camposInvalidos.has(campo.id) ? "text-destructive" : "text-muted-foreground")}>
                      {campo.nombre}
                      {esObligatorioAhora(campo) && <span className="text-destructive"> *</span>}
                    </Label>
                    {renderCampo(campo, campos)}
                    {campo.ayuda && <p className="text-xs text-muted-foreground">{campo.ayuda}</p>}
                  </div>
                ))}
            </div>

            <div className="flex w-64 shrink-0 flex-col gap-4 border-l border-border pl-5">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Estímulo</Label>
                {estimulos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tenés estímulos disponibles para aplicar.</p>
                ) : (
                  <Select
                    items={Object.fromEntries(estimulos.map((e) => [e.id, e.nombre]))}
                    value={idEstimulo ?? undefined}
                    onValueChange={(v) => setIdEstimulo(v ?? null)}
                    disabled={!canGestionar}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccioná…" />
                    </SelectTrigger>
                    <SelectContent>
                      {estimulos.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex flex-1 flex-col space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observación</Label>
                <textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  onKeyDown={(e) => handleTabEnTextarea(e, setObservacion)}
                  disabled={!canGestionar}
                  rows={6}
                  className="w-full flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {exito && (
                <p className="flex items-center gap-1.5 text-sm text-emerald-500">
                  <CheckCircle2 className="size-3.5" />
                  Trámite gestionado correctamente.
                </p>
              )}
              {!canGestionar && <p className="text-xs text-muted-foreground">Tu perfil no tiene permiso de gestión sobre esta herramienta.</p>}
            </div>
          </div>
        )}

        {/* Montadas una sola vez (no se remontan al volver a la solapa), ocultas con
            CSS — mismo criterio de keep-alive que legajo-layout-modal.tsx. */}
        {idTramite && idEntidadTramites && (
          <div className={cn("flex-1 overflow-y-auto", activeTab !== "historial" && "hidden")}>
            <HistorialTool idLegajo={idTramite} idEntidad={idEntidadTramites} />
          </div>
        )}

        {idTramite && idEntidadTramites && (
          <div className={cn("flex-1 overflow-hidden", activeTab !== "adjuntos" && "hidden")}>
            <ArchivosAdjuntosTool
              idLegajo={idTramite}
              idEntidad={idEntidadTramites}
              canGestionar={canGestionar}
              revision={revisionAdjuntos}
              onCambio={() => setRevisionAdjuntos((r) => r + 1)}
            />
          </div>
        )}

        <DialogFooter className="border-t border-border px-5 py-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {activeTab === "datos" && (
            <Button onClick={handleGestionar} disabled={!canGestionar || !idEstimulo || pending || campos === null}>
              {pending ? "Gestionando…" : "Gestionar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
