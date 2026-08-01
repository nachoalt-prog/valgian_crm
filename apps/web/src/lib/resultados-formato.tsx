import { Badge } from "@/components/ui/badge";

// Formato/orden compartido entre BandejaResultados y ReporteResultados — mismo
// vocabulario de "tipo" de columna (badge/fecha/default), ver ADR 0014.
export type Direccion = "asc" | "desc";

export function compararValores(a: unknown, b: unknown, direccion: Direccion): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a < b) return direccion === "asc" ? -1 : 1;
  if (a > b) return direccion === "asc" ? 1 : -1;
  return 0;
}

export function formatearValor(valor: unknown, tipo?: string): React.ReactNode {
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
