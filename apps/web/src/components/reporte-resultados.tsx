"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Download, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { compararValores, formatearValor, type Direccion } from "@/lib/resultados-formato";
import type { ColumnaReporte } from "@valgian/core";

interface ReporteResultadosProps {
  columnas: ColumnaReporte[];
  rows: Record<string, unknown>[];
  loading: boolean;
  searched: boolean;
  pagina: number;
  hayMas: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onExport: (formato: "csv" | "tsv") => void;
  /** Solo relevante si algún REPORTES.COLUMNAS tiene tipo:"adjuntos" (ver resultados-formato.tsx). */
  onVerAdjuntos?: (valor: unknown) => void;
}

export function ReporteResultados({
  columnas,
  rows,
  loading,
  searched,
  pagina,
  hayMas,
  onPrevPage,
  onNextPage,
  onExport,
  onVerAdjuntos,
}: ReporteResultadosProps) {
  const [ordenCampo, setOrdenCampo] = useState<string | null>(null);
  const [ordenDireccion, setOrdenDireccion] = useState<Direccion | null>(null);

  // El orden solo aplica a la página actual — el resultado ya viene paginado del servidor.
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

  if (rows.length === 0 && pagina === 0) {
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasOrdenadas.map((row, idx) => (
              <TableRow key={String(row.id ?? idx)}>
                {columnas.map((c) => (
                  <TableCell key={c.campo}>{formatearValor(row[c.campo], c.tipo, onVerAdjuntos)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-2.5">
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onExport("csv")} className="h-7 gap-1.5 px-2.5 text-xs">
            <Download className="size-3.5" />
            CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onExport("tsv")} className="h-7 gap-1.5 px-2.5 text-xs">
            <Download className="size-3.5" />
            TSV
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Página {pagina + 1}</span>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" disabled={pagina === 0} onClick={onPrevPage} className="size-7">
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button size="icon" variant="ghost" disabled={!hayMas} onClick={onNextPage} className="size-7">
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
