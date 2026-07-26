"use client";

import { useEffect, useState } from "react";
import { PlusCircle, Pencil, Trash2, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BandejaFiltroDialog } from "@/components/bandeja-filtro-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  listBandejaFiltrosAction,
  createBandejaFiltroAction,
  updateBandejaFiltroAction,
  deleteBandejaFiltroAction,
} from "@/app/dashboard/bandejas-admin/actions";
import type { BandejaFiltroConNombre } from "@valgian/core";

interface FiltroOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface BandejaFiltrosAdminProps {
  bandejaId: string;
  filtrosDisponibles: FiltroOption[];
  canGestionar: boolean;
  onSinPermiso: () => void;
}

export function BandejaFiltrosAdmin({ bandejaId, filtrosDisponibles, canGestionar, onSinPermiso }: BandejaFiltrosAdminProps) {
  const [vinculos, setVinculos] = useState<BandejaFiltroConNombre[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BandejaFiltroConNombre | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<BandejaFiltroConNombre | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    listBandejaFiltrosAction(bandejaId).then((res) => {
      if (!cancelado) setVinculos(res);
    });
    return () => {
      cancelado = true;
    };
  }, [bandejaId]);

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(v: BandejaFiltroConNombre) {
    if (!canGestionar) return onSinPermiso();
    setEditing(v);
    setDialogOpen(true);
  }

  function pedirBorrado(v: BandejaFiltroConNombre) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(v);
  }

  async function handleSave(data: { idFiltro: string; campo: string; orden: number }, id?: string) {
    const result = id ? await updateBandejaFiltroAction(id, data) : await createBandejaFiltroAction({ idBandeja: bandejaId, ...data });
    if (!result.error) setVinculos(await listBandejaFiltrosAction(bandejaId));
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deleteBandejaFiltroAction(deleteConfirm.id);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteConfirm(null);
    setVinculos(await listBandejaFiltrosAction(bandejaId));
  }

  return (
    <section className="flex flex-col border-b border-border">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          <ListFilter className="size-4 text-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-accent">Filtros de esta bandeja</h3>
        </div>
        <Button size="sm" variant="outline" onClick={abrirNuevo} className="h-7 gap-1.5 text-xs">
          <PlusCircle className="size-3.5" />
          Agregar
        </Button>
      </div>

      <div className="px-5 pb-4">
        {vinculos === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : vinculos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin filtros vinculados todavía.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {vinculos.map((v) => (
              <li key={v.id} className="group flex items-center justify-between px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {v.orden}
                  </Badge>
                  <span className="truncate text-sm text-foreground">{v.filtroNombre}</span>
                  <span className="font-mono text-xs text-muted-foreground">→ {v.campo}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => abrirEdicion(v)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(v)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BandejaFiltroDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vinculo={editing}
        filtrosDisponibles={filtrosDisponibles}
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
        title="Quitar Filtro de la Bandeja"
        description={deleteError ?? `¿Quitás el filtro "${deleteConfirm?.filtroNombre}" de esta bandeja?`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
