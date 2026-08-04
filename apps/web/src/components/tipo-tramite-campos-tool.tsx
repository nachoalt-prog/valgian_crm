"use client";

import { useEffect, useState } from "react";
import { PlusCircle, Pencil, Trash2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TipoTramiteCampoDialog } from "@/components/tipo-tramite-campo-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  listTiposTramiteCamposAction,
  crearTipoTramiteCampoAction,
  actualizarTipoTramiteCampoAction,
  borrarTipoTramiteCampoAction,
  listEstadosPorEstrategiaAction,
} from "@/app/dashboard/tipos-tramite/actions";
import type { TipoTramiteCampoConTipo, TipoTramiteCampoInput } from "@valgian/core";

interface EstadoOption {
  id: string;
  nombre: string;
}

interface TipoTramiteCamposToolProps {
  idTipoTramite: string;
  idEstrategia: string | null;
  canGestionar: boolean;
  onSinPermiso: () => void;
}

export function TipoTramiteCamposTool({ idTipoTramite, idEstrategia, canGestionar, onSinPermiso }: TipoTramiteCamposToolProps) {
  const [campos, setCampos] = useState<TipoTramiteCampoConTipo[] | null>(null);
  const [estados, setEstados] = useState<EstadoOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TipoTramiteCampoConTipo | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TipoTramiteCampoConTipo | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function recargar() {
    const [camposRes, estadosRes] = await Promise.all([
      listTiposTramiteCamposAction(idTipoTramite),
      idEstrategia ? listEstadosPorEstrategiaAction(idEstrategia) : Promise.resolve({ data: [] as EstadoOption[] }),
    ]);
    setCampos(camposRes.data ?? []);
    setEstados(estadosRes.data ?? []);
  }

  useEffect(() => {
    setCampos(null);
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTipoTramite, idEstrategia]);

  function abrirNuevo() {
    if (!canGestionar) return onSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(c: TipoTramiteCampoConTipo) {
    if (!canGestionar) return onSinPermiso();
    setEditing(c);
    setDialogOpen(true);
  }

  function pedirBorrado(c: TipoTramiteCampoConTipo) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(c);
  }

  async function handleSave(data: TipoTramiteCampoInput, id?: string) {
    const result = id ? await actualizarTipoTramiteCampoAction(id, data) : await crearTipoTramiteCampoAction(idTipoTramite, data);
    if (!result.error) await recargar();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await borrarTipoTramiteCampoAction(deleteConfirm.id);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteConfirm(null);
    await recargar();
  }

  function labelObligatorio(c: TipoTramiteCampoConTipo): string {
    if (c.obligatorioEnEstados.length === 0) return "Nunca";
    if (estados.length > 0 && c.obligatorioEnEstados.length === estados.length) return "Siempre";
    return `${c.obligatorioEnEstados.length} de ${estados.length || "?"} estados`;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Campos</h3>
        </div>
        <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {campos === null ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Cargando…</div>
        ) : campos.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <ListChecks className="size-7 opacity-30" />
            <p className="text-sm">Este tipo de trámite no tiene campos configurados.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Obligatorio para pasar a</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campos.map((c) => (
                <TableRow key={c.id} className="group">
                  <TableCell className="font-mono text-xs text-primary">{c.codigo}</TableCell>
                  <TableCell>{c.nombre}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.tipoCampoCodigo ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.orden ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.obligatorioEnEstados.length === 0 ? "secondary" : "outline"} className="text-[10px]">
                      {labelObligatorio(c)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => abrirEdicion(c)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(c)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <TipoTramiteCampoDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} campo={editing} estados={estados} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Campo"
        description={deleteError ?? `¿Eliminás el campo "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
