"use client";

import { useEffect, useState } from "react";
import { PlusCircle, Trash2, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CampoTexto, CampoSelect, CampoBooleano } from "@/components/campo-editable";
import { ClienteDialog } from "@/components/cliente-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  listClientesPorLegajoAction,
  getCatalogosClienteAction,
  createClienteAction,
  updateClienteAction,
  deleteClienteAction,
} from "@/app/dashboard/clientes/actions";
import type { ClienteConNombres, ClienteInput } from "@valgian/core";

interface Opcion {
  id: string;
  codigo: string;
  nombre: string;
}

interface Catalogos {
  caracteres: Opcion[];
  tiposDocumento: Opcion[];
  generos: Opcion[];
  provincias: Opcion[];
}

interface ClientesAbmToolProps {
  idLegajo: string;
  canGestionar: boolean;
}

export function ClientesAbmTool({ idLegajo, canGestionar }: ClientesAbmToolProps) {
  const [clientes, setClientes] = useState<ClienteConNombres[] | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ClienteConNombres | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function recargar() {
    setClientes(await listClientesPorLegajoAction(idLegajo));
  }

  useEffect(() => {
    let cancelado = false;
    Promise.all([listClientesPorLegajoAction(idLegajo), getCatalogosClienteAction()]).then(([cli, cat]) => {
      if (!cancelado) {
        setClientes(cli);
        setCatalogos(cat);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [idLegajo]);

  async function handleCrear(data: ClienteInput) {
    const result = await createClienteAction(data);
    if (!result.error) await recargar();
    return result;
  }

  async function handleBorrar() {
    if (!deleteConfirm) return;
    const result = await deleteClienteAction(deleteConfirm.id);
    if (result?.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleteConfirm(null);
    if (selectedId === deleteConfirm.id) setSelectedId(null);
    await recargar();
  }

  async function actualizarCampo(cliente: ClienteConNombres, cambios: Partial<ClienteInput>) {
    const data: ClienteInput = {
      idLegajo,
      idCaracter: cliente.idCaracter,
      esTitular: cliente.esTitular ?? false,
      idTipoDocumento: cliente.idTipoDocumento,
      nroDocumento: cliente.nroDocumento,
      apellido: cliente.apellido,
      nombre: cliente.nombre,
      idGenero: cliente.idGenero,
      idProvincia: cliente.idProvincia,
      ...cambios,
    };
    const result = await updateClienteAction(cliente.id, data);
    if (!result.error) await recargar();
    return result;
  }

  const seleccionado = clientes?.find((c) => c.id === selectedId) ?? null;

  if (clientes === null || catalogos === null) {
    return <p className="p-5 text-sm text-muted-foreground">Cargando…</p>;
  }

  return (
    <div className="flex h-full gap-3 p-3">
      <aside className="w-56 shrink-0 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">Clientes</h3>
          </div>
          {canGestionar && (
            <Button size="icon" variant="ghost" className="size-6" onClick={() => setDialogOpen(true)}>
              <PlusCircle className="size-3.5" />
            </Button>
          )}
        </div>
        <ul className="divide-y divide-border overflow-y-auto">
          {clientes.length === 0 && <li className="px-3 py-6 text-center text-xs text-muted-foreground">Sin clientes.</li>}
          {clientes.map((c) => {
            const isSelected = selectedId === c.id;
            return (
              <li
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`group flex cursor-pointer items-center justify-between border-l-2 px-3 py-2.5 transition-colors ${
                  isSelected ? "border-l-primary bg-primary/10" : "border-l-transparent hover:bg-muted/60"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-foreground">
                      {c.apellido}, {c.nombre}
                    </span>
                  </div>
                  {c.esTitular && (
                    <Badge variant="outline" className="mt-0.5 h-4 px-1.5 text-[9px]">
                      Titular
                    </Badge>
                  )}
                </div>
                {canGestionar && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteError(null);
                      setDeleteConfirm(c);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="flex-1 overflow-y-auto rounded-lg border border-border p-4">
        {!seleccionado ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <User className="size-8 opacity-30" />
            <p className="text-sm">Seleccioná un cliente para ver sus datos.</p>
          </div>
        ) : (
          <div key={seleccionado.id}>
            <CampoTexto
              label="Apellido"
              valor={seleccionado.apellido ?? ""}
              editable={canGestionar}
              onSave={(v) => actualizarCampo(seleccionado, { apellido: v })}
            />
            <CampoTexto
              label="Nombre"
              valor={seleccionado.nombre}
              editable={canGestionar}
              onSave={(v) => actualizarCampo(seleccionado, { nombre: v })}
            />
            <CampoSelect
              label="Carácter"
              valorId={seleccionado.idCaracter}
              valorLabel={seleccionado.caracterNombre ?? ""}
              opciones={catalogos.caracteres.map((c) => ({ value: c.id, label: c.nombre }))}
              editable={canGestionar}
              onSave={(v) => actualizarCampo(seleccionado, { idCaracter: v })}
            />
            <CampoBooleano
              label="Es Titular"
              valor={seleccionado.esTitular ?? false}
              editable={canGestionar}
              onSave={(v) => actualizarCampo(seleccionado, { esTitular: v })}
            />
            <CampoSelect
              label="Tipo Documento"
              valorId={seleccionado.idTipoDocumento}
              valorLabel={seleccionado.tipoDocumentoCodigo ?? ""}
              opciones={catalogos.tiposDocumento.map((t) => ({ value: t.id, label: t.nombre }))}
              editable={canGestionar}
              onSave={(v) => actualizarCampo(seleccionado, { idTipoDocumento: v })}
            />
            <CampoTexto
              label="Nro. Documento"
              valor={seleccionado.nroDocumento ?? ""}
              editable={canGestionar}
              onSave={(v) => actualizarCampo(seleccionado, { nroDocumento: v })}
            />
            <CampoSelect
              label="Género"
              valorId={seleccionado.idGenero}
              valorLabel={seleccionado.generoNombre ?? ""}
              opciones={catalogos.generos.map((g) => ({ value: g.id, label: g.nombre }))}
              editable={canGestionar}
              onSave={(v) => actualizarCampo(seleccionado, { idGenero: v })}
            />
            <CampoSelect
              label="Provincia"
              valorId={seleccionado.idProvincia}
              valorLabel={seleccionado.provinciaNombre ?? ""}
              opciones={catalogos.provincias.map((p) => ({ value: p.id, label: p.nombre }))}
              editable={canGestionar}
              onSave={(v) => actualizarCampo(seleccionado, { idProvincia: v })}
            />
          </div>
        )}
      </div>

      <ClienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        idLegajo={idLegajo}
        caracteres={catalogos.caracteres}
        tiposDocumento={catalogos.tiposDocumento}
        generos={catalogos.generos}
        onSave={handleCrear}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null);
            setDeleteError(null);
          }
        }}
        title="Eliminar Cliente"
        description={deleteError ?? `¿Eliminás a "${deleteConfirm?.apellido}, ${deleteConfirm?.nombre}"? Esta acción no se puede deshacer.`}
        isError={!!deleteError}
        onConfirm={handleBorrar}
      />
    </div>
  );
}
