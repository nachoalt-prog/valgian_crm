"use client";

import { useEffect, useState } from "react";
import { PlusCircle, Pencil, Trash2, PanelTop, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutSolapaDialog } from "@/components/layout-solapa-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  listLayoutSolapasAction,
  createLayoutSolapaAction,
  updateLayoutSolapaAction,
  deleteLayoutSolapaAction,
} from "@/app/dashboard/layouts-legajo/actions";
import type { SolapaConNombre } from "@valgian/core";

interface HerramientaOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface LayoutSolapasAdminProps {
  idLayout: string;
  herramientasDisponibles: HerramientaOption[];
  canGestionar: boolean;
  onSinPermiso: () => void;
}

export function LayoutSolapasAdmin({ idLayout, herramientasDisponibles, canGestionar, onSinPermiso }: LayoutSolapasAdminProps) {
  const [solapas, setSolapas] = useState<SolapaConNombre[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SolapaConNombre | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SolapaConNombre | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    listLayoutSolapasAction(idLayout).then((res) => {
      if (!cancelado) setSolapas(res);
    });
    return () => {
      cancelado = true;
    };
  }, [idLayout]);

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(s: SolapaConNombre) {
    if (!canGestionar) return onSinPermiso();
    setEditing(s);
    setDialogOpen(true);
  }

  function pedirBorrado(s: SolapaConNombre) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(s);
  }

  async function handleSave(
    data: { orden: number; nombre: string; idHerramienta: string | null; visible: boolean; parametros: Record<string, unknown> | null },
    id?: string,
  ) {
    const result = id
      ? await updateLayoutSolapaAction(id, { idLayout, ...data })
      : await createLayoutSolapaAction({ idLayout, ...data });
    if (!result.error) setSolapas(await listLayoutSolapasAction(idLayout));
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deleteLayoutSolapaAction(deleteConfirm.id);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteConfirm(null);
    setSolapas(await listLayoutSolapasAction(idLayout));
  }

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <PanelTop className="size-4 text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-widest text-accent">Solapas</h3>
        </div>
        <Button size="sm" variant="outline" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs" disabled={(solapas?.length ?? 0) >= 10}>
          <PlusCircle className="size-3.5" />
          Agregar
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {solapas === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : solapas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin solapas configuradas todavía (hasta 10).</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {solapas.map((s) => (
              <li key={s.id} className="group flex items-center justify-between px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Badge variant="outline" className="text-[10px]">
                    {s.orden}
                  </Badge>
                  <span className="truncate text-sm font-medium text-foreground">{s.nombre}</span>
                  {s.herramientaNombre ? (
                    <span className="font-mono text-xs text-muted-foreground">→ {s.herramientaCodigo}</span>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">vacía</span>
                  )}
                  {!s.visible && <EyeOff className="size-3.5 shrink-0 text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => abrirEdicion(s)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(s)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <LayoutSolapaDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        solapa={editing}
        herramientasDisponibles={herramientasDisponibles}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Solapa"
        description={deleteError ?? `¿Eliminás la solapa "${deleteConfirm?.nombre}"?`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
