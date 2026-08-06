"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { XccCondicionImpositivaDialog } from "@/components/xcc-condicion-impositiva-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { CondicionImpositivaInput } from "@valgian/module-cuenta-corriente";
import {
  createCondicionImpositivaAction,
  updateCondicionImpositivaAction,
  deleteCondicionImpositivaAction,
} from "@/app/dashboard/xcc-condiciones-impositivas/actions";

export interface CondicionImpositivaRow {
  id: string;
  codigo: string;
  nombre: string;
}

interface XccCondicionesImpositivasToolProps {
  condicionesIniciales: CondicionImpositivaRow[];
  canGestionar: boolean;
}

export function XccCondicionesImpositivasTool({ condicionesIniciales, canGestionar }: XccCondicionesImpositivasToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CondicionImpositivaRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CondicionImpositivaRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  function abrirNuevo() {
    if (!canGestionar) return avisarSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(c: CondicionImpositivaRow) {
    if (!canGestionar) return avisarSinPermiso();
    setEditing(c);
    setDialogOpen(true);
  }

  function pedirBorrado(c: CondicionImpositivaRow) {
    if (!canGestionar) return avisarSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(c);
  }

  async function handleSave(data: CondicionImpositivaInput, id?: string) {
    const result = id ? await updateCondicionImpositivaAction(id, data) : await createCondicionImpositivaAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deleteCondicionImpositivaAction(deleteConfirm.id);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteConfirm(null);
    router.refresh();
  }

  return (
    <div className="h-full overflow-hidden rounded-xl border border-border">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg">
          {aviso}
        </div>
      )}

      <section className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Condiciones Impositivas (Cuenta Corriente)</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nueva
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {condicionesIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Receipt className="size-8 opacity-30" />
              <p className="text-sm">Sin condiciones impositivas creadas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {condicionesIniciales.map((c) => (
                  <TableRow key={c.id} className="group">
                    <TableCell className="font-mono text-xs text-primary">{c.codigo}</TableCell>
                    <TableCell>{c.nombre}</TableCell>
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
      </section>

      <XccCondicionImpositivaDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} condicion={editing} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Condición Impositiva"
        description={deleteError ?? `¿Eliminás la condición "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
