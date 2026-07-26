"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, FolderOpen, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ColumnaBandeja } from "@valgian/core";

interface BandejaResultadosProps {
  columnas: ColumnaBandeja[];
  rows: Record<string, unknown>[];
  loading: boolean;
  searched: boolean;
  onOpen: (row: Record<string, unknown>) => void;
}

type Direccion = "asc" | "desc";

function compararValores(a: unknown, b: unknown, direccion: Direccion): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a < b) return direccion === "asc" ? -1 : 1;
  if (a > b) return direccion === "asc" ? 1 : -1;
  return 0;
}

function formatearValor(valor: unknown, tipo?: string): React.ReactNode {
  if (valor === null || valor === undefined) return <span className="text-muted-foreground">—</span>;
  if (tipo === "fecha") return new Date(String(valor)).toLocaleDateString("es-AR");
  if (tipo === "badge") {
    return (
      <Badge variant="outline" className="text-[11px]">
        {String(valor)}
      </Badge>
    );
  }
  return String(valor);
}

export function BandejaResultados({ columnas, rows, loading, searched, onOpen }: BandejaResultadosProps) {
  const [ordenCampo, setOrdenCampo] = useState<string | null>(null);
  const [ordenDireccion, setOrdenDireccion] = useState<Direccion | null>(null);

  const filasOrdenadas = useMemo(() => {
    if (!ordenCampo || !ordenDireccion) return rows;
    return [...rows].sort((a, b) => compararValores(a[ordenCampo], b[ordenCampo], ordenDireccion));
  }, [rows, ordenCampo, ordenDireccion]);

  function handleOrdenar(campo: string) {
    if (ordenCampo !== campo) {
      setOrdenCampo(campo);
      setOrdenDireccion("asc");
    } else if (ordenDireccion === "asc") {
      setOrdenDireccion("desc");
    } else {
      setOrdenCampo(null);
      setOrdenDireccion(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin text-primary" />
        <span className="text-sm">Buscando…</span>
      </div>
    );
  }

  if (!searched) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Inbox className="size-12 text-muted-foreground/30" />
        <p className="text-sm">
          Aplicá los filtros y presioná <span className="font-medium text-primary">Buscar</span> para ver resultados.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Inbox className="size-10 text-muted-foreground/30" />
        <p className="text-sm">No se encontraron resultados con los filtros aplicados.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columnas.map((c) => {
                const activa = ordenCampo === c.campo;
                const Icono = activa ? (ordenDireccion === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
                return (
                  <TableHead key={c.campo}>
                    <button
                      type="button"
                      onClick={() => handleOrdenar(c.campo)}
                      className={cn(
                        "flex items-center gap-1 select-none hover:text-foreground",
                        activa ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {c.label}
                      <Icono className={cn("size-3.5", !activa && "opacity-40")} />
                    </button>
                  </TableHead>
                );
              })}
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasOrdenadas.map((row, idx) => (
              <TableRow key={String(row.id ?? idx)} className="group">
                {columnas.map((c) => (
                  <TableCell key={c.campo}>{formatearValor(row[c.campo], c.tipo)}</TableCell>
                ))}
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpen(row)}
                    className="h-7 gap-1.5 px-2.5 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/10 hover:text-primary"
                  >
                    <FolderOpen className="size-3.5" />
                    Abrir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-2.5">
        <span className="text-xs text-muted-foreground">
          {rows.length} resultado{rows.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
