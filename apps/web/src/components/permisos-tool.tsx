"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PermisoDialog } from "@/components/permiso-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { PermisoConNombres } from "@valgian/core";
import { createPermisoAction, updatePermisoAction, deletePermisoAction } from "@/app/dashboard/permisos/actions";

interface Option {
  id: string;
  codigo: string;
  nombre: string;
}

interface PermisosToolProps {
  permisosIniciales: PermisoConNombres[];
  perfiles: Option[];
  herramientas: Option[];
  canGestionar: boolean;
}

export function PermisosTool({ permisosIniciales, perfiles, herramientas, canGestionar }: PermisosToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PermisoConNombres | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PermisoConNombres | null>(null);
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

  function abrirEdicion(p: PermisoConNombres) {
    if (!canGestionar) return avisarSinPermiso();
    setEditing(p);
    setDialogOpen(true);
  }

  function pedirBorrado(p: PermisoConNombres) {
    if (!canGestionar) return avisarSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(p);
  }

  async function handleSave(data: { idPerfil: string; idHerramienta: string; gestionar: boolean }, id?: string) {
    const result = id ? await updatePermisoAction(id, data.gestionar) : await createPermisoAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deletePermisoAction(deleteConfirm.id);
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
            <KeyRound className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Permisos</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nuevo
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {permisosIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <KeyRound className="size-8 opacity-30" />
              <p className="text-sm">Sin permisos cargados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Herramienta</TableHead>
                  <TableHead>Gestionar</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permisosIniciales.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell>
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 font-mono text-[10px] text-primary">
                        [{p.perfilCodigo}] {p.perfilNombre}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-accent/40 bg-accent/10 font-mono text-[10px] text-accent">
                        [{p.herramientaCodigo}] {p.herramientaNombre}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.gestionar ? (
                        <Badge className="h-4 border-primary/30 bg-primary/20 px-1.5 text-[10px] text-primary">Sí</Badge>
                      ) : (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                          Solo lectura
                        </Badge>
                      )}
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

      <PermisoDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        permiso={editing}
        perfiles={perfiles}
        herramientas={herramientas}
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
        title="Eliminar Permiso"
        description={
          deleteError ??
          `¿Eliminás el permiso de "${deleteConfirm?.perfilNombre}" sobre "${deleteConfirm?.herramientaNombre}"?`
        }
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
