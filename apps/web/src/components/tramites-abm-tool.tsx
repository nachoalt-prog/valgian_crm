"use client";

import { useEffect, useState } from "react";
import { FileStack, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TramiteModal } from "@/components/tramite-modal";
import {
  listCategoriasAction,
  listTiposTramitePorCategoriaAction,
  resolverCandidatosAplicarAAction,
  listTramitesPorLegajoAction,
  listTodosTiposTramiteAction,
  listUsuariosAction,
} from "@/app/dashboard/tramites/actions";
import type { TramiteListadoFila, FiltrosTramitesLegajo } from "@valgian/core";

interface TramitesAbmToolProps {
  idLegajo: string;
  idEntidad?: string;
  canGestionar: boolean;
  revision: number;
  onCambio: () => void;
}

interface Opcion {
  id: string;
  nombre: string;
}

interface ModalTarget {
  idTipoTramite: string;
  idRegistro: string;
  idTramite?: string | null;
}

function formatearFecha(fecha: Date | string | null): string {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleString("es-AR");
}

export function TramitesAbmTool({ idLegajo, canGestionar, revision, onCambio }: TramitesAbmToolProps) {
  const [categorias, setCategorias] = useState<Opcion[]>([]);
  const [idCategoria, setIdCategoria] = useState<string | null>(null);
  const [tipos, setTipos] = useState<Opcion[]>([]);
  const [idTipoTramite, setIdTipoTramite] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<Opcion[]>([]);
  const [idRegistroSeleccionado, setIdRegistroSeleccionado] = useState<string | null>(null);

  const [listado, setListado] = useState<TramiteListadoFila[] | null>(null);
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);

  const [filtrosVisibles, setFiltrosVisibles] = useState(false);
  const [tiposFiltro, setTiposFiltro] = useState<Opcion[]>([]);
  const [usuariosFiltro, setUsuariosFiltro] = useState<Opcion[]>([]);
  const [formFiltros, setFormFiltros] = useState<FiltrosTramitesLegajo>({});
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosTramitesLegajo>({});

  useEffect(() => {
    listCategoriasAction().then((res) => setCategorias(res.data ?? []));
    listTodosTiposTramiteAction().then((res) => setTiposFiltro(res.data ?? []));
    listUsuariosAction().then((res) => setUsuariosFiltro((res.data ?? []).map((u) => ({ id: u.id, nombre: u.username }))));
  }, []);

  useEffect(() => {
    let cancelado = false;
    listTramitesPorLegajoAction(idLegajo, filtrosAplicados).then((res) => {
      if (!cancelado) setListado(res.data ?? []);
    });
    return () => {
      cancelado = true;
    };
  }, [idLegajo, revision, filtrosAplicados]);

  useEffect(() => {
    if (!idCategoria) return;
    let cancelado = false;
    listTiposTramitePorCategoriaAction(idCategoria).then((res) => {
      if (!cancelado) setTipos(res.data ?? []);
    });
    return () => {
      cancelado = true;
    };
  }, [idCategoria]);

  function handleCategoriaChange(v: string | null) {
    setIdCategoria(v);
    setIdTipoTramite(null);
    setTipos([]);
    setIdRegistroSeleccionado(null);
    setCandidatos([]);
  }

  useEffect(() => {
    if (!idTipoTramite) return;
    let cancelado = false;
    resolverCandidatosAplicarAAction(idTipoTramite, idLegajo).then((res) => {
      if (!cancelado) setCandidatos((res.data ?? []).map((c) => ({ id: c.id, nombre: c.label })));
    });
    return () => {
      cancelado = true;
    };
  }, [idTipoTramite, idLegajo]);

  function handleTipoTramiteChange(v: string | null) {
    setIdTipoTramite(v);
    setIdRegistroSeleccionado(null);
    setCandidatos([]);
  }

  function handleBuscar() {
    setFiltrosAplicados({ ...formFiltros });
  }

  function handleGestionado() {
    onCambio();
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div className="flex items-center gap-2">
        <FileStack className="size-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">Trámites</h3>
      </div>

      {/* Lanzar nuevo trámite */}
      <div className="grid grid-cols-4 items-end gap-3 rounded-lg border border-border p-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Categoría</Label>
          <Select items={Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))} value={idCategoria} onValueChange={(v) => handleCategoriaChange(v ?? null)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccioná…" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo de Trámite</Label>
          <Select
            items={Object.fromEntries(tipos.map((t) => [t.id, t.nombre]))}
            value={idTipoTramite}
            onValueChange={(v) => handleTipoTramiteChange(v ?? null)}
            disabled={!idCategoria}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccioná…" />
            </SelectTrigger>
            <SelectContent>
              {tipos.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Aplicar a</Label>
          <Select
            items={Object.fromEntries(candidatos.map((c) => [c.id, c.nombre]))}
            value={idRegistroSeleccionado}
            onValueChange={(v) => setIdRegistroSeleccionado(v ?? null)}
            disabled={!idTipoTramite}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccioná…" />
            </SelectTrigger>
            <SelectContent>
              {candidatos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          disabled={!canGestionar || !idTipoTramite || !idRegistroSeleccionado}
          onClick={() => setModalTarget({ idTipoTramite: idTipoTramite!, idRegistro: idRegistroSeleccionado! })}
        >
          Iniciar
        </Button>
      </div>

      {/* Listado */}
      <div className="flex-1 overflow-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo de Trámite</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Alta</TableHead>
              <TableHead>Última gestión</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {listado === null ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : listado.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Sin trámites registrados.
                </TableCell>
              </TableRow>
            ) : (
              listado.map((fila) => (
                <TableRow key={fila.id}>
                  <TableCell>{fila.tipoTramiteNombre ?? "—"}</TableCell>
                  <TableCell>{fila.estadoNombre ?? "—"}</TableCell>
                  <TableCell>{formatearFecha(fila.altaFecha)}</TableCell>
                  <TableCell>{formatearFecha(fila.auditFecha)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModalTarget({ idTipoTramite: fila.idTipoTramite, idRegistro: fila.idRegistro ?? "", idTramite: fila.id })}
                    >
                      Gestionar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Filtros */}
      <div className="shrink-0 rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setFiltrosVisibles((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <SlidersHorizontal className="size-3.5" />
          Filtros
        </button>
        {filtrosVisibles && (
          <div className="grid grid-cols-3 gap-3 border-t border-border p-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo de Trámite</Label>
              <Select
                items={Object.fromEntries(tiposFiltro.map((t) => [t.id, t.nombre]))}
                value={formFiltros.idTipoTramite ?? ""}
                onValueChange={(v) => setFormFiltros((f) => ({ ...f, idTipoTramite: v ?? undefined }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {tiposFiltro.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Usuario de Alta</Label>
              <Select
                items={Object.fromEntries(usuariosFiltro.map((u) => [u.id, u.nombre]))}
                value={formFiltros.altaUsuario ?? ""}
                onValueChange={(v) => setFormFiltros((f) => ({ ...f, altaUsuario: v ?? undefined }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {usuariosFiltro.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Usuario de Gestión</Label>
              <Select
                items={Object.fromEntries(usuariosFiltro.map((u) => [u.id, u.nombre]))}
                value={formFiltros.auditUsuario ?? ""}
                onValueChange={(v) => setFormFiltros((f) => ({ ...f, auditUsuario: v ?? undefined }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {usuariosFiltro.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fecha de Alta (desde)</Label>
              <Input type="date" value={formFiltros.altaFechaDesde ?? ""} onChange={(e) => setFormFiltros((f) => ({ ...f, altaFechaDesde: e.target.value || undefined }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fecha de Alta (hasta)</Label>
              <Input type="date" value={formFiltros.altaFechaHasta ?? ""} onChange={(e) => setFormFiltros((f) => ({ ...f, altaFechaHasta: e.target.value || undefined }))} />
            </div>
            <div />

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fecha de Gestión (desde)</Label>
              <Input type="date" value={formFiltros.auditFechaDesde ?? ""} onChange={(e) => setFormFiltros((f) => ({ ...f, auditFechaDesde: e.target.value || undefined }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fecha de Gestión (hasta)</Label>
              <Input type="date" value={formFiltros.auditFechaHasta ?? ""} onChange={(e) => setFormFiltros((f) => ({ ...f, auditFechaHasta: e.target.value || undefined }))} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleBuscar} className="w-full">
                Buscar
              </Button>
            </div>
          </div>
        )}
      </div>

      {modalTarget && (
        <TramiteModal
          key={`${modalTarget.idTipoTramite}-${modalTarget.idRegistro}-${modalTarget.idTramite ?? "nuevo"}`}
          open={!!modalTarget}
          onOpenChange={(open) => !open && setModalTarget(null)}
          idTipoTramite={modalTarget.idTipoTramite}
          idRegistro={modalTarget.idRegistro}
          idTramite={modalTarget.idTramite}
          canGestionar={canGestionar}
          onGestionado={handleGestionado}
        />
      )}
    </div>
  );
}
