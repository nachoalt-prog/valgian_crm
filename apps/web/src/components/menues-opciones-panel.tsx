"use client";

import { useState } from "react";
import { PlusCircle, Pencil, Trash2, LayoutList, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveIcon } from "@/lib/icons";
import { MenuOpcionDialog } from "@/components/menu-opcion-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { MenuConContador, MenuOpcionConHerramienta } from "@valgian/core";

interface HerramientaOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface MenuesOpcionesPanelProps {
  opciones: MenuOpcionConHerramienta[];
  selectedMenu: MenuConContador | null;
  herramientas: HerramientaOption[];
  canGestionar: boolean;
  onSinPermiso: () => void;
  onSave: (
    data: {
      idMenu: string;
      idHerramienta: string | null;
      codigo: string;
      nombre: string;
      icono: string | null;
      orden: number | null;
    },
    id?: string,
  ) => Promise<{ error?: string } | void>;
  onDelete: (id: string) => Promise<{ error?: string } | void>;
}

export function MenuesOpcionesPanel({
  opciones,
  selectedMenu,
  herramientas,
  canGestionar,
  onSinPermiso,
  onSave,
  onDelete,
}: MenuesOpcionesPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuOpcionConHerramienta | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MenuOpcionConHerramienta | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filtradas = selectedMenu ? opciones.filter((o) => o.idMenu === selectedMenu.id) : opciones;

  function abrirNuevo() {
    if (!selectedMenu) return;
    if (!canGestionar) return onSinPermiso();
    setEditing(null);
    setDialogOpen(true);
  }

  function abrirEdicion(o: MenuOpcionConHerramienta) {
    if (!canGestionar) return onSinPermiso();
    setEditing(o);
    setDialogOpen(true);
  }

  function pedirBorrado(o: MenuOpcionConHerramienta) {
    if (!canGestionar) return onSinPermiso();
    setDeleteError(null);
    setDeleteConfirm(o);
  }

  async function confirmarBorrado() {
    if (!deleteConfirm) return;
    const result = await onDelete(deleteConfirm.id);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteConfirm(null);
  }

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <LayoutList className="size-4 shrink-0 text-accent" />
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-accent">Opciones</h2>
            {selectedMenu && (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono text-primary">[{selectedMenu.codigo}]</span> {selectedMenu.nombre}
                </span>
              </>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={abrirNuevo}
          disabled={!selectedMenu}
          className="h-8 shrink-0 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 text-xs"
        >
          <PlusCircle className="size-3.5" />
          Nuevo
        </Button>
      </div>

      {!selectedMenu && (
        <div className="border-b border-border bg-muted/30 px-5 py-2.5">
          <p className="text-xs text-muted-foreground">Seleccioná un menú para ver y agregar sus opciones.</p>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {filtradas.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <LayoutList className="size-8 opacity-30" />
            <p className="text-sm">Sin opciones{selectedMenu ? " en este menú" : ""}.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Herramienta</TableHead>
                <TableHead className="hidden lg:table-cell">Orden</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((o) => {
                const Icon = resolveIcon(o.icono);
                return (
                  <TableRow key={o.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{o.nombre}</span>
                        <span className="font-mono text-xs text-muted-foreground">[{o.codigo}]</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {o.herramientaNombre ?? <span className="italic">Sin herramienta</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{o.orden ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-accent" onClick={() => abrirEdicion(o)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => pedirBorrado(o)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedMenu && (
        <MenuOpcionDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          opcion={editing}
          menuId={selectedMenu.id}
          herramientas={herramientas}
          onSave={onSave}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Opción"
        description={deleteError ?? `¿Eliminás la opción "${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={confirmarBorrado}
      />
    </section>
  );
}
