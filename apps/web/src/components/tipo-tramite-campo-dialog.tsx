"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listTiposCamposAction } from "@/app/dashboard/tipos-tramite/actions";
import type { TipoTramiteCampoConTipo, TipoTramiteCampoInput } from "@valgian/core";

interface EstadoOption {
  id: string;
  nombre: string;
}

interface TipoCampoOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface TipoTramiteCampoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campo: TipoTramiteCampoConTipo | null;
  estados: EstadoOption[];
  onSave: (data: TipoTramiteCampoInput, id?: string) => Promise<{ error?: string } | void>;
}

function numOrNull(v: string): number | null {
  return v.trim() === "" ? null : Number(v);
}

// key={campo?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function TipoTramiteCampoDialog({ open, onOpenChange, campo, estados, onSave }: TipoTramiteCampoDialogProps) {
  const [tiposCampos, setTiposCampos] = useState<TipoCampoOption[]>([]);
  const [codigo, setCodigo] = useState(campo?.codigo ?? "");
  const [nombre, setNombre] = useState(campo?.nombre ?? "");
  const [idTipoCampo, setIdTipoCampo] = useState<string | null>(campo?.idTipoCampo ?? null);
  const [orden, setOrden] = useState(campo?.orden != null ? String(campo.orden) : "");
  const [visible, setVisible] = useState(campo?.visible ?? true);
  const [editable, setEditable] = useState(campo?.editable ?? true);
  const [longitudMax, setLongitudMax] = useState(campo?.longitudMax != null ? String(campo.longitudMax) : "");
  const [numMin, setNumMin] = useState(campo?.numMin != null ? String(campo.numMin) : "");
  const [numMax, setNumMax] = useState(campo?.numMax != null ? String(campo.numMax) : "");
  const [numStep, setNumStep] = useState(campo?.numStep != null ? String(campo.numStep) : "");
  const [radioGroup, setRadioGroup] = useState(campo?.radioGroup != null ? String(campo.radioGroup) : "");
  const [placeholder, setPlaceholder] = useState(campo?.placeholder ?? "");
  const [ayuda, setAyuda] = useState(campo?.ayuda ?? "");
  const [regex, setRegex] = useState(campo?.regex ?? "");
  const [listaValores, setListaValores] = useState(campo?.listaValores ?? "");
  const [idsEstadosObligatorio, setIdsEstadosObligatorio] = useState<string[]>(campo?.obligatorioEnEstados ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    listTiposCamposAction().then((res) => setTiposCampos(res.data ?? []));
  }, []);

  const todosSeleccionados = estados.length > 0 && idsEstadosObligatorio.length === estados.length;

  function toggleEstado(id: string) {
    setIdsEstadosObligatorio((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleTodos() {
    setIdsEstadosObligatorio(todosSeleccionados ? [] : estados.map((e) => e.id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await onSave(
      {
        codigo,
        nombre,
        idTipoCampo,
        orden: numOrNull(orden),
        visible,
        editable,
        longitudMax: numOrNull(longitudMax),
        numMin: numOrNull(numMin),
        numMax: numOrNull(numMax),
        numStep: numOrNull(numStep),
        radioGroup: numOrNull(radioGroup),
        placeholder: placeholder.trim() || null,
        ayuda: ayuda.trim() || null,
        regex: regex.trim() || null,
        listaValores: listaValores.trim() || null,
        obligatorioEnEstados: idsEstadosObligatorio,
      },
      campo?.id,
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
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{campo ? "Editar Campo" : "Nuevo Campo"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto py-2 pr-1">
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
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo de campo</Label>
              <Select
                items={Object.fromEntries(tiposCampos.map((t) => [t.id, t.nombre]))}
                value={idTipoCampo}
                onValueChange={(v) => setIdTipoCampo(v ?? null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccioná…" />
                </SelectTrigger>
                <SelectContent>
                  {tiposCampos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orden" className="text-xs uppercase tracking-wider text-muted-foreground">
                Orden
              </Label>
              <Input id="orden" type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <Label htmlFor="visible" className="text-sm font-normal">
                Visible
              </Label>
              <Switch id="visible" checked={visible} onCheckedChange={setVisible} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <Label htmlFor="editable" className="text-sm font-normal">
                Editable
              </Label>
              <Switch id="editable" checked={editable} onCheckedChange={setEditable} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="placeholder" className="text-xs uppercase tracking-wider text-muted-foreground">
                Placeholder
              </Label>
              <Input id="placeholder" value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ayuda" className="text-xs uppercase tracking-wider text-muted-foreground">
                Ayuda
              </Label>
              <Input id="ayuda" value={ayuda} onChange={(e) => setAyuda(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="longitudMax" className="text-xs uppercase tracking-wider text-muted-foreground">
                Longitud máx.
              </Label>
              <Input id="longitudMax" type="number" min={0} value={longitudMax} onChange={(e) => setLongitudMax(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regex" className="text-xs uppercase tracking-wider text-muted-foreground">
                Regex
              </Label>
              <Input id="regex" value={regex} onChange={(e) => setRegex(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="numMin" className="text-xs uppercase tracking-wider text-muted-foreground">
                Mín.
              </Label>
              <Input id="numMin" type="number" value={numMin} onChange={(e) => setNumMin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="numMax" className="text-xs uppercase tracking-wider text-muted-foreground">
                Máx.
              </Label>
              <Input id="numMax" type="number" value={numMax} onChange={(e) => setNumMax(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="numStep" className="text-xs uppercase tracking-wider text-muted-foreground">
                Paso
              </Label>
              <Input id="numStep" type="number" value={numStep} onChange={(e) => setNumStep(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="radioGroup" className="text-xs uppercase tracking-wider text-muted-foreground">
                Grupo de radio buttons
              </Label>
              <Input id="radioGroup" type="number" value={radioGroup} onChange={(e) => setRadioGroup(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="listaValores" className="text-xs uppercase tracking-wider text-muted-foreground">
                Lista de valores (SQL de confianza)
              </Label>
              <Input id="listaValores" value={listaValores} onChange={(e) => setListaValores(e.target.value)} placeholder="Solo SELECT/SELECT_MULTIPLE" />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Obligatorio para pasar a estos estados</Label>
              {estados.length > 0 && (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={todosSeleccionados} onChange={toggleTodos} className="size-3.5 accent-primary" />
                  Todos (siempre)
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Se evalúa contra el estado destino de la transición que dispara el estímulo elegido, no el estado en el que el trámite ya está.
            </p>
            {estados.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Este tipo de trámite no tiene estrategia asignada todavía — no hay estados para elegir.
              </p>
            ) : (
              <ul className="max-h-40 overflow-y-auto rounded-lg border border-border">
                {estados.map((es) => (
                  <li key={es.id} className="border-b border-border last:border-b-0">
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={idsEstadosObligatorio.includes(es.id)}
                        onChange={() => toggleEstado(es.id)}
                        className="size-4 accent-primary"
                      />
                      <span className="text-sm text-foreground">{es.nombre}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {campo ? "Guardar cambios" : "Crear campo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
