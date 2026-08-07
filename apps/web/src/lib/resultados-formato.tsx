import { Paperclip, ListOrdered, FileSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Formato/orden compartido entre BandejaResultados y ReporteResultados — mismo
// vocabulario de "tipo" de columna (badge/fecha/fecha_hora/adjuntos/pasos/
// detalle_importacion/default), se amplía cuando hace falta (ver ADR 0014) —
// "adjuntos" sumado para el reporte de Mensajería (domain/acciones-externas.md),
// "pasos" para el reporte de Procesos (domain/procesos.md), "detalle_importacion"
// para el reporte de Importaciones (domain/reportes.md, nivel 2 genérico por
// introspección): en los tres casos el valor de la columna es el ID de la fila
// dueña del detalle (MENSAJERIA_COLA.ID / PROCESOS_EJECUCIONES.ID /
// IMPORTADORES_EJECUCIONES.ID), no un texto a mostrar.
export type Direccion = "asc" | "desc";

// Tonos semánticos para tipo:"badge" — configurables por columna vía
// REPORTES.COLUMNAS[].colores (mapa valor-crudo -> tono), ver domain/reportes.md.
// Solo Reportes lo usa hoy (Bandejas no pasa "colores", así que sus badges
// siguen viéndose igual que siempre — el fallback sin tono no cambia nada).
const TONO_CLASES: Record<string, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  error: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function compararValores(a: unknown, b: unknown, direccion: Direccion): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a < b) return direccion === "asc" ? -1 : 1;
  if (a > b) return direccion === "asc" ? 1 : -1;
  return 0;
}

export function formatearValor(
  valor: unknown,
  tipo?: string,
  onVerAdjuntos?: (valor: unknown) => void,
  onVerPasos?: (valor: unknown) => void,
  colores?: Record<string, string>,
  onVerDetalleImportacion?: (valor: unknown) => void,
): React.ReactNode {
  if (tipo === "adjuntos") {
    if (valor === null || valor === undefined) return <span className="text-muted-foreground">—</span>;
    return (
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => onVerAdjuntos?.(valor)}>
        <Paperclip className="size-3.5" />
      </Button>
    );
  }
  if (tipo === "pasos") {
    if (valor === null || valor === undefined) return <span className="text-muted-foreground">—</span>;
    return (
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => onVerPasos?.(valor)}>
        <ListOrdered className="size-3.5" />
      </Button>
    );
  }
  if (tipo === "detalle_importacion") {
    if (valor === null || valor === undefined) return <span className="text-muted-foreground">—</span>;
    return (
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => onVerDetalleImportacion?.(valor)}>
        <FileSearch className="size-3.5" />
      </Button>
    );
  }
  if (valor === null || valor === undefined) return <span className="text-muted-foreground">—</span>;
  if (tipo === "fecha") return new Date(String(valor)).toLocaleDateString("es-AR");
  if (tipo === "fecha_hora") return new Date(String(valor)).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  if (tipo === "badge") {
    const tono = colores?.[String(valor)];
    return (
      <Badge variant="outline" className={cn("text-[11px]", tono && TONO_CLASES[tono])}>
        {String(valor)}
      </Badge>
    );
  }
  return String(valor);
}
