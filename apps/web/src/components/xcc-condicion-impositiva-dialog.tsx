"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CondicionImpositivaInput, AlicuotaPorCondicionFila } from "@valgian/module-cuenta-corriente";
import type { CondicionImpositivaRow } from "@/components/xcc-condiciones-impositivas-tool";
import { listAlicuotasPorCondicionAction, setAlicuotaCondicionRetencionAction } from "@/app/dashboard/xcc-condiciones-impositivas/actions";

interface XccCondicionImpositivaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condicion: CondicionImpositivaRow | null;
  onSave: (data: CondicionImpositivaInput, id?: string) => Promise<{ error?: string } | void>;
}

interface FilaAlicuotaProps {
  idCondicion: string;
  fila: AlicuotaPorCondicionFila;
  onGuardado: () => void;
}

function FilaAlicuota({ idCondicion, fila, onGuardado }: FilaAlicuotaProps) {
  const [valor, setValor] = useState(fila.alicuotaOverride !== null ? String(fila.alicuotaOverride) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const trimmed = valor.trim();
    const alicuota = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (alicuota !== null && Number.isNaN(alicuota)) {
      setError("Número inválido.");
      return;
    }

    setPending(true);
    setError(null);
    const result = await setAlicuotaCondicionRetencionAction(idCondicion, fila.idTipoRetencion, alicuota);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onGuardado();
  }

  return (
    <li className="flex flex-col gap-1 px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div>
          <p className="text-foreground">{fila.tipoRetencionNombre}</p>
          <p className="text-xs text-muted-foreground">Default: {fila.alicuotaDefault ?? 0}%</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Hereda default"
            className="h-8 w-28 text-sm"
            disabled={pending}
          />
          <Button size="icon" className="size-7 shrink-0" onClick={guardar} disabled={pending} aria-label={`Guardar alícuota de ${fila.tipoRetencionNombre}`}>
            <Check className="size-3.5" />
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}

// key={condicion?.id ?? "new"} en el padre fuerza un remount al cambiar de registro.
export function XccCondicionImpositivaDialog({ open, onOpenChange, condicion, onSave }: XccCondicionImpositivaDialogProps) {
  const [codigo, setCodigo] = useState(condicion?.codigo ?? "");
  const [nombre, setNombre] = useState(condicion?.nombre ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [alicuotas, setAlicuotas] = useState<AlicuotaPorCondicionFila[] | null>(null);

  useEffect(() => {
    if (!open || !condicion) return;
    let cancelado = false;
    setAlicuotas(null);
    listAlicuotasPorCondicionAction(condicion.id).then((res) => {
      if (!cancelado) setAlicuotas(res.data ?? []);
    });
    return () => {
      cancelado = true;
    };
  }, [open, condicion]);

  function refrescarAlicuotas() {
    if (!condicion) return;
    listAlicuotasPorCondicionAction(condicion.id).then((res) => setAlicuotas(res.data ?? []));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!codigo.trim() || !nombre.trim()) {
      setError("Completá código y nombre.");
      return;
    }

    setPending(true);
    const result = await onSave({ codigo: codigo.trim(), nombre }, condicion?.id);
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
          <DialogTitle>{condicion ? "Editar Condición Impositiva" : "Nueva Condición Impositiva"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="codigo" className="text-xs uppercase tracking-wider text-muted-foreground">
              Código
            </Label>
            <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ej. monotributista" className="font-mono text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre" className="text-xs uppercase tracking-wider text-muted-foreground">
              Nombre
            </Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="ej. Monotributista" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {condicion ? "Guardar cambios" : "Crear condición"}
            </Button>
          </DialogFooter>
        </form>

        {condicion && (
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Alícuotas por tipo de retención</p>
            {alicuotas === null ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : alicuotas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay tipos de retención "por condición impositiva" configurados todavía.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {alicuotas.map((a) => (
                  <FilaAlicuota key={a.idTipoRetencion} idCondicion={condicion.id} fila={a} onGuardado={refrescarAlicuotas} />
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
