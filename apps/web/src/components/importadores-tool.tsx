"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Pencil, Trash2, FolderInput, Play, Loader2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ImportadorDialog } from "@/components/importador-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { ImportadorInput } from "@valgian/core";
import { createImportadorAction, updateImportadorAction, deleteImportadorAction, dispararImportadorAutomaticoAction } from "@/app/dashboard/importadores/actions";

export interface ImportadorRow {
  id: string;
  codigo: string;
  nombre: string;
  tablaStaging: string;
  spNombre: string;
  extensionesPermitidas: string;
  rutaDirectorio: string | null;
  patronNombreArchivo: string | null;
  tablaHistorico: string | null;
  diasRetencionHistorico: number | null;
  carpetaDestinoProcesados: string | null;
  disparoAutomaticoActivo: boolean | null;
  modoErrorAutomatico: string | null;
  activo: boolean | null;
  ejecutandose: boolean;
}

interface ImportadoresToolProps {
  importadoresIniciales: ImportadorRow[];
  canGestionar: boolean;
}

export function ImportadoresTool({ importadoresIniciales, canGestionar }: ImportadoresToolProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ImportadorRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ImportadorRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [disparando, setDisparando] = useState<string | null>(null);

  // Mientras algún importador esté corriendo, refresca cada 3s para que el
  // spinner desaparezca solo apenas termine — mismo patrón que ProcesosTool.
  const hayActivos = importadoresIniciales.some((i) => i.ejecutandose);
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

  function abrirEdicion(i: ImportadorRow) {
    if (!canGestionar) return mostrarAviso("No tenés permiso de gestión sobre esta herramienta.");
    setEditing(i);
    setDialogOpen(true);
  }

  function pedirBorrado(i: ImportadorRow) {
    if (!canGestionar) return mostrarAviso("No tenés permiso de gestión sobre esta herramienta.");
    setDeleteError(null);
    setDeleteConfirm(i);
  }

  async function handleSave(data: ImportadorInput, id?: string) {
    const result = id ? await updateImportadorAction(id, data) : await createImportadorAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await deleteImportadorAction(deleteConfirm.id);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteConfirm(null);
    router.refresh();
  }

  async function correrAhora(i: ImportadorRow) {
    if (!canGestionar) return mostrarAviso("No tenés permiso de gestión sobre esta herramienta.");
    setDisparando(i.id);
    const result = await dispararImportadorAutomaticoAction(i.id);
    setDisparando(null);
    mostrarAviso(result?.error ? `Error: ${result.error}` : `"${i.nombre}" encolado — busca el archivo en el directorio configurado.`);
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
            <FolderInput className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Importadores</h2>
          </div>
          <Button size="sm" onClick={abrirNuevo} className="h-8 gap-1.5 text-xs">
            <PlusCircle className="size-3.5" />
            Nuevo
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {importadoresIniciales.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <FolderInput className="size-8 opacity-30" />
              <p className="text-sm">Sin importadores creados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Extensiones</TableHead>
                  <TableHead>Modo automático</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importadoresIniciales.map((i) => (
                  <TableRow key={i.id} className="group">
                    <TableCell className="font-mono text-xs text-primary">{i.codigo}</TableCell>
                    <TableCell>{i.nombre}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{i.extensionesPermitidas}</TableCell>
                    <TableCell>
                      {i.disparoAutomaticoActivo ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Solo wizard</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {i.activo ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-500">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive">
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {i.ejecutandose ? (
                          <div className="flex size-7 items-center justify-center text-primary" title="Ejecutándose">
                            <Loader2 className="size-3.5 animate-spin" />
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-primary"
                            disabled={disparando === i.id || !i.rutaDirectorio}
                            onClick={() => correrAhora(i)}
                            title={i.rutaDirectorio ? "Correr ahora (buscar archivo)" : "Sin ruta de directorio configurada"}
                          >
                            <Play className="size-3.5" />
                          </Button>
                        )}
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <a
                                href={`/api/importadores/${i.id}/modelo`}
                                className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-primary"
                                aria-label="Descargar archivo modelo"
                              >
                                <HelpCircle className="size-3.5" />
                              </a>
                            }
                          />
                          <TooltipContent side="top" className="text-xs">
                            Descargar archivo modelo
                          </TooltipContent>
                        </Tooltip>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => abrirEdicion(i)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(i)}>
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

      <ImportadorDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} importador={editing} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Importador"
        description={deleteError ?? `¿Eliminás "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </div>
  );
}
