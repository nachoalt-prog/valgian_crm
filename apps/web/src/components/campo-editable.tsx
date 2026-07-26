"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CampoWrapperProps {
  label: string;
  editing: boolean;
  editable: boolean;
  error: string | null;
  pending: boolean;
  valorMostrado: string;
  onEditar: () => void;
  onGuardar: () => void;
  onCancelar: () => void;
  children: React.ReactNode;
}

function CampoWrapper({ label, editing, editable, error, pending, valorMostrado, onEditar, onGuardar, onCancelar, children }: CampoWrapperProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {editing ? (
        <div className="flex items-center gap-2">
          {children}
          <Button size="icon" className="size-7 shrink-0" onClick={onGuardar} disabled={pending} aria-label={`Guardar ${label}`}>
            <Check className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={onCancelar} disabled={pending} aria-label={`Cancelar ${label}`}>
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <div className="group flex items-center justify-between">
          <span className="text-sm text-foreground">{valorMostrado || "—"}</span>
          {editable && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
              onClick={onEditar}
              aria-label={`Editar ${label}`}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface CampoTextoProps {
  label: string;
  valor: string;
  editable: boolean;
  onSave?: (valor: string) => Promise<{ error?: string } | void>;
}

export function CampoTexto({ label, valor, editable, onSave }: CampoTextoProps) {
  const [editing, setEditing] = useState(false);
  const [valorEdit, setValorEdit] = useState(valor);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function guardar() {
    if (!onSave) return;
    setPending(true);
    setError(null);
    const result = await onSave(valorEdit);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
  }

  return (
    <CampoWrapper
      label={label}
      editing={editing}
      editable={editable}
      error={error}
      pending={pending}
      valorMostrado={valor}
      onEditar={() => setEditing(true)}
      onGuardar={guardar}
      onCancelar={() => {
        setEditing(false);
        setValorEdit(valor);
        setError(null);
      }}
    >
      <Input value={valorEdit} onChange={(e) => setValorEdit(e.target.value)} className="h-8 text-sm" autoFocus disabled={pending} />
    </CampoWrapper>
  );
}

interface OpcionSelect {
  value: string;
  label: string;
}

interface CampoSelectProps {
  label: string;
  valorId: string | null;
  valorLabel: string;
  opciones: OpcionSelect[];
  editable: boolean;
  onSave?: (valorId: string) => Promise<{ error?: string } | void>;
}

export function CampoSelect({ label, valorId, valorLabel, opciones, editable, onSave }: CampoSelectProps) {
  const [editing, setEditing] = useState(false);
  const [valorEdit, setValorEdit] = useState(valorId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function guardar() {
    if (!onSave) return;
    setPending(true);
    setError(null);
    const result = await onSave(valorEdit);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
  }

  return (
    <CampoWrapper
      label={label}
      editing={editing}
      editable={editable}
      error={error}
      pending={pending}
      valorMostrado={valorLabel}
      onEditar={() => setEditing(true)}
      onGuardar={guardar}
      onCancelar={() => {
        setEditing(false);
        setValorEdit(valorId ?? "");
        setError(null);
      }}
    >
      <Select
        items={Object.fromEntries(opciones.map((o) => [o.value, o.label]))}
        value={valorEdit || undefined}
        onValueChange={(v) => setValorEdit(v ?? "")}
      >
        <SelectTrigger className="h-8 w-full text-sm">
          <SelectValue placeholder="Seleccioná…" />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </CampoWrapper>
  );
}

interface CampoBooleanoProps {
  label: string;
  valor: boolean;
  editable: boolean;
  onSave?: (valor: boolean) => Promise<{ error?: string } | void>;
}

export function CampoBooleano({ label, valor, editable, onSave }: CampoBooleanoProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (!onSave || !editable) return;
    setPending(true);
    setError(null);
    const result = await onSave(!valor);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex flex-col gap-1 border-b border-border py-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <label className={`flex items-center gap-2.5 ${editable ? "cursor-pointer" : ""}`}>
        <input type="checkbox" checked={valor} disabled={!editable || pending} onChange={toggle} className="size-4 accent-primary" />
        <span className="text-sm text-foreground">{valor ? "Sí" : "No"}</span>
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
