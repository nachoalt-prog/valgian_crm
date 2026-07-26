"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PerfilEstimuloDialog } from "@/components/perfil-estimulo-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { PerfilEstimuloConNombres, PerfilEstimuloInput, EstimuloConEstrategia } from "@valgian/core";
import { createPerfilEstimuloAction, deletePerfilEstimuloAction } from "@/app/dashboard/perfiles-estimulos/actions";

interface Option {
  id: string;
  codigo: string;
  nombre: string;
}

interface PerfilesEstimulosToolProps {
  vinculosIniciales: PerfilEstimuloConNombres[];
  perfiles: Option[];
  estimulos: EstimuloConEstrategia[];
  canGestionar: boolean;
}

export function PerfilesEstimulosTool({ vinculosIniciales, perfiles, estimulos, canGestionar }: PerfilesEstimulosToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<PerfilEstimuloConNombres | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  function abrirNuevo() {
    if (!canGestionar) return avisarSinPermiso();
    setDialogOpen(true);
  }

  function pedirBorrado(v: PerfilEstimuloConNombres) {
    if (!canGestionar) return avisarSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(v);
  }

  async function handleSave(data: PerfilEstimuloInput) {
    const result = await createPerfilEstimuloAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deletePerfilEstimuloAction(deleteConfirm.id);
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
            <Zap className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Perfiles-Estímulos</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nuevo
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {vinculosIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Zap className="size-8 opacity-30" />
              <p className="text-sm">Sin vínculos cargados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Estrategia</TableHead>
                  <TableHead>Estímulo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vinculosIniciales.map((v) => (
                  <TableRow key={v.id} className="group">
                    <TableCell>
                      <Badge variant="outline" className="border-primary/40 bg-primary/10 font-mono text-[10px] text-primary">
                        [{v.perfilCodigo}] {v.perfilNombre}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.estrategiaNombre}</TableCell>
                    <TableCell className="text-sm text-foreground">{v.estimuloNombre}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(v)}>
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

      <PerfilEstimuloDialog open={dialogOpen} onOpenChange={setDialogOpen} perfiles={perfiles} estimulos={estimulos} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Perfil-Estímulo"
        description={deleteError ?? `¿Eliminás el vínculo de "${deleteConfirm?.perfilNombre}" con "${deleteConfirm?.estimuloNombre}"?`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
