import { LayoutDashboard, Users, ListTree, Palette, KeyRound, Package, Inbox, Filter, LayoutTemplate, Zap, Braces, FileCode, FileType, type LucideIcon, Circle } from "lucide-react";

/**
 * MENUES_OPCIONES.ICONO guarda una clave propia y estable (no el nombre de un
 * ícono de lucide-react directamente) — ver ADR 0011. Este diccionario es el
 * único lugar que mapea esa clave al componente real.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  "icon.dashboard": LayoutDashboard,
  "icon.usuarios": Users,
  "icon.menues": ListTree,
  "icon.interfaces": Palette,
  "icon.permisos": KeyRound,
  "icon.productos": Package,
  "icon.bandejas": Inbox,
  "icon.filtros": Filter,
  "icon.layouts": LayoutTemplate,
  "icon.perfilesEstimulos": Zap,
  "icon.placeholders": Braces,
  "icon.plantillasAdjuntos": FileCode,
  "icon.tiposAdjuntos": FileType,
};

export const ICON_KEYS = Object.keys(ICON_MAP);

export function resolveIcon(key: string | null): LucideIcon {
  if (!key) return Circle;
  return ICON_MAP[key] ?? Circle;
}
