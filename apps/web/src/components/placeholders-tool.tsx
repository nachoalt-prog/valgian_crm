"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlaceholderDialog } from "@/components/placeholder-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { PlaceholderInput } from "@valgian/core";
import { createPlaceholderAction, updatePlaceholderAction, deletePlaceholderAction } from "@/app/dashboard/placeholders/actions";

interface PlaceholderRow {
  id: string;
  codigo: string;
  nombre: string;
  query: string | null;
  escapar: boolean | null;
}

interface PlaceholdersToolProps {
  placeholdersIniciales: PlaceholderRow[];
  canGestionar: boolean;
}

export function PlaceholdersTool({ placeholdersIniciales, canGestionar }: PlaceholdersToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlaceholderRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PlaceholderRow | null>(null);
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

  function abrirEdicion(p: PlaceholderRow) {
    if (!canGestionar) return avisarSinPermiso();
    setEditing(p);
    setDialogOpen(true);
  }

  function pedirBorrado(p: PlaceholderRow) {
    if (!canGestionar) return avisarSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(p);
  }

  async function handleSave(data: PlaceholderInput, id?: string) {
    const result = id ? await updatePlaceholderAction(id, data) : await createPlaceholderAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deletePlaceholderAction(deleteConfirm.id);
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
            <Braces className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Placeholders</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nuevo
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {placeholdersIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Braces className="size-8 opacity-30" />
              <p className="text-sm">Sin placeholders creados. Creá el primero.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Escapar</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {placeholdersIniciales.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell className="font-mono text-xs text-primary">##{p.codigo}##</TableCell>
                    <TableCell>{p.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {p.escapar !== false ? "Sí" : "No (HTML de confianza)"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => abrirEdicion(p)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(p)}>
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

      <PlaceholderDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} placeholder={editing} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Placeholder"
        description={deleteError ?? `¿Eliminás el placeholder "##${deleteConfirm?.codigo}##"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
