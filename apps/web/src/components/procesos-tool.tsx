"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, Timer, Play, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProcesoDialog } from "@/components/proceso-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import type { ProcesoInput } from "@valgian/core";
import {
  createProcesoAction,
  updateProcesoAction,
  deleteProcesoAction,
  dispararProcesoManualAction,
  cancelarEjecucionProcesoAction,
} from "@/app/dashboard/procesos/actions";

interface ProcesoRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  cron: string;
  activo: boolean | null;
  reintentoMinutos: number | null;
  reintentosMax: number | null;
  ejecutandose: boolean;
}

interface ProcesosToolProps {
  procesosIniciales: ProcesoRow[];
  canGestionar: boolean;
}

export function ProcesosTool({ procesosIniciales, canGestionar }: ProcesosToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProcesoRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProcesoRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [disparando, setDisparando] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [hoverStop, setHoverStop] = useState<string | null>(null);

  // Mientras algún proceso esté pendiente/procesando, refresca cada 3s para
  // que el spinner desaparezca solo apenas termine (sin esto, quedaría
  // "colgado" hasta la próxima acción manual del usuario).
  const hayActivos = procesosIniciales.some((p) => p.ejecutandose);
  useEffect(() => {
    if (!hayActivos) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [hayActivos, router]);

  function mostrarAviso(mensaje: string) {
    setAviso(mensaje);
    setTimeout(() => setAviso(null), 3500);
  }

  function abrirNuevo() {
    if (!canGestionar) return mostrarAviso("No tenés permiso de gestión sobre esta herramienta.");
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(p: ProcesoRow) {
    if (!canGestionar) return mostrarAviso("No tenés permiso de gestión sobre esta herramienta.");
    setEditing(p);
    setDialogOpen(true);
  }

  function pedirBorrado(p: ProcesoRow) {
    if (!canGestionar) return mostrarAviso("No tenés permiso de gestión sobre esta herramienta.");
    setDeleteError(null);
    setDeleteConfirm(p);
  }

  async function handleSave(data: ProcesoInput, id?: string) {
    const result = id ? await updateProcesoAction(id, data) : await createProcesoAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deleteProcesoAction(deleteConfirm.id);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteConfirm(null);
    router.refresh();
  }

  async function correrAhora(p: ProcesoRow) {
    if (!canGestionar) return mostrarAviso("No tenés permiso de gestión sobre esta herramienta.");
    setDisparando(p.id);
    const result = await dispararProcesoManualAction(p.id);
    setDisparando(null);
    mostrarAviso(result?.error ? `Error: ${result.error}` : `"${p.nombre}" encolado — lo va a tomar el próximo ejecutor disponible.`);
    if (!result?.error) router.refresh();
  }

  async function cancelarProceso(p: ProcesoRow) {
    if (!canGestionar) return mostrarAviso("No tenés permiso de gestión sobre esta herramienta.");
    setCancelando(p.id);
    const result = await cancelarEjecucionProcesoAction(p.id);
    setCancelando(null);
    mostrarAviso(result?.error ? `Error: ${result.error}` : `"${p.nombre}" cancelado.`);
    if (!result?.error) router.refresh();
  }

  return (
    <div className="h-full overflow-hidden rounded-xl border border-border">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-border bg-card px-4 py-2.5 text-sm shadow-lg">{aviso}</div>
      )}

      <section className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Procesos</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nuevo
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {procesosIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Timer className="size-8 opacity-30" />
              <p className="text-sm">Sin procesos creados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cron</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Reintentos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procesosIniciales.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell className="font-mono text-xs text-primary">{p.codigo}</TableCell>
                    <TableCell>{p.nombre}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.cron}</TableCell>
                    <TableCell>
                      <Badge variant={p.activo ? "outline" : "destructive"} className="text-[10px]">
                        {p.activo ? "Activo" : "Pausado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.reintentosMax ?? "—"} máx · cada {p.reintentoMinutos ?? "—"} min
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.ejecutandose ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn("size-7", hoverStop === p.id ? "text-destructive hover:text-destructive" : "text-primary")}
                                  disabled={cancelando === p.id}
                                  onMouseEnter={() => setHoverStop(p.id)}
                                  onMouseLeave={() => setHoverStop(null)}
                                  onClick={() => cancelarProceso(p)}
                                >
                                  {hoverStop === p.id ? <Square className="size-3.5 fill-current" /> : <Loader2 className="size-3.5 animate-spin" />}
                                </Button>
                              }
                            />
                            <TooltipContent side="top" className="text-xs">
                              Cancelar ejecución
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-primary"
                            disabled={disparando === p.id}
                            onClick={() => correrAhora(p)}
                            title="Correr ahora"
                          >
                            <Play className="size-3.5" />
                          </Button>
                        )}
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => abrirEdicion(p)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(p)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <ProcesoDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} proceso={editing} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Proceso"
        description={deleteError ?? `¿Eliminás "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
