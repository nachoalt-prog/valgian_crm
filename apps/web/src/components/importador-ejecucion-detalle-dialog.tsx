"use client";

import { useEffect, useState } from "react";
import { FileSearch, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDetalleEjecucionImportadorAction } from "@/app/dashboard/reportes/importadores-detalle-actions";
import type { ResultadosValidacion } from "@valgian/core";

interface ImportadorEjecucionDetalleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idEjecucion: string;
}

function badgeEstadoValidacion(valor: unknown) {
  const v = String(valor ?? "").toLowerCase();
  if (v === "ok") {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
        OK
      </Badge>
    );
  }
  if (v === "advertencia") {
    return (
      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500">
        Advertencia
      </Badge>
    );
  }
  if (v === "error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="secondary">{v || "—"}</Badge>;
}

/**
 * Nivel 2 del reporte de auditoría "Importaciones" — genérico, no conoce de
 * antemano el schema de ningún importador puntual: arma la tabla por
 * introspección (getDetalleEjecucionImportadorAction, mismo mecanismo que el
 * paso de validación del wizard). Reusable para CUALQUIER importador que se
 * agregue a futuro, sin dialog/action nuevos por caso — ver domain/reportes.md.
 */
export function ImportadorEjecucionDetalleDialog({ open, onOpenChange, idEjecucion }: ImportadorEjecucionDetalleDialogProps) {
  const [resultado, setResultado] = useState<ResultadosValidacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setResultado(null);
    setError(null);
    setLoading(true);

    getDetalleEjecucionImportadorAction(idEjecucion, 0).then((res) => {
      if (cancelado) return;
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      setResultado(res.data ?? null);
    });

    return () => {
      cancelado = true;
    };
  }, [open, idEjecucion]);

  async function irAPagina(pagina: number) {
    setLoading(true);
    const res = await getDetalleEjecucionImportadorAction(idEjecucion, pagina);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResultado(res.data ?? null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full overflow-x-hidden overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="size-4" />
            Detalle de la importación
          </DialogTitle>
        </DialogHeader>

        <div className="min-w-0 py-2">
          {loading && resultado === null && !error && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando…
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && resultado && resultado.filas.length === 0 && <p className="text-sm text-muted-foreground">Esta ejecución no tiene registros.</p>}
          {!error && resultado && resultado.filas.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {resultado.columnas.map((c) => (
                      <TableHead key={c}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.filas.map((fila, idx) => (
                    <TableRow key={idx}>
                      {resultado.columnas.map((c) => (
                        <TableCell key={c} className={c === "MENSAJE_VALIDACION" ? "text-xs text-muted-foreground" : "text-sm"}>
                          {c === "ESTADO_VALIDACION" ? badgeEstadoValidacion(fila[c]) : String(fila[c] ?? "—")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {resultado && (resultado.pagina > 0 || resultado.hayMas) && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={resultado.pagina === 0 || loading} onClick={() => irAPagina(resultado.pagina - 1)}>
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">Página {resultado.pagina + 1}</span>
              <Button variant="outline" size="sm" disabled={!resultado.hayMas || loading} onClick={() => irAPagina(resultado.pagina + 1)}>
                Siguiente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
