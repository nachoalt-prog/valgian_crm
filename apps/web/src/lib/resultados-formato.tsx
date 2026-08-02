import { Paperclip, ListOrdered } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Formato/orden compartido entre BandejaResultados y ReporteResultados — mismo
// vocabulario de "tipo" de columna (badge/fecha/fecha_hora/adjuntos/pasos/default),
// se amplía cuando hace falta (ver ADR 0014) — "adjuntos" sumado para el reporte
// de Mensajería (domain/acciones-externas.md), "pasos" para el reporte de
// Procesos (domain/procesos.md): en ambos casos el valor de la columna es el ID
// de la fila dueña del detalle (MENSAJERIA_COLA.ID / PROCESOS_EJECUCIONES.ID),
// no un texto a mostrar.
export type Direccion = "asc" | "desc";

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
  if (valor === null || valor === undefined) return <span className="text-muted-foreground">—</span>;
  if (tipo === "fecha") return new Date(String(valor)).toLocaleDateString("es-AR");
  if (tipo === "fecha_hora") return new Date(String(valor)).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  if (tipo === "badge") {
    return (
      <Badge variant="outline" className="text-[11px]">
        {String(valor)}
      </Badge>
    );
  }
  return String(valor);
}
