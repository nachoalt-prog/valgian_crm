"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIcon } from "@/lib/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { logoutAction } from "@/app/dashboard/actions";

interface MenuOpcion {
  id: string;
  codigo: string;
  nombre: string;
  icono: string | null;
}

interface MenuGrupo {
  nombre: string;
  opciones: MenuOpcion[];
}

// MENUES_OPCIONES.CODIGO -> ruta real. Cada herramienta nueva suma su entrada acá.
const RUTA_POR_CODIGO: Record<string, string> = {
  dashboard: "/dashboard",
  usuarios_perfiles: "/dashboard/usuarios",
  menues: "/dashboard/menues",
  interfaces: "/dashboard/interfaces",
  permisos: "/dashboard/permisos",
  productos: "/dashboard/productos",
  bandejas: "/dashboard/bandejas",
  filtros: "/dashboard/filtros",
  bandejas_admin: "/dashboard/bandejas-admin",
  layouts_legajo: "/dashboard/layouts-legajo",
  perfiles_estimulos: "/dashboard/perfiles-estimulos",
  placeholders: "/dashboard/placeholders",
  plantillas_adjuntos: "/dashboard/plantillas-adjuntos",
};

export function AppSidebar({ menu, titulo }: { menu: MenuGrupo[]; titulo?: string | null }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200 ease-in-out shrink-0",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border h-14 shrink-0 px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-6 rounded bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-bold text-[10px] tracking-tight">CRM</span>
            </div>
            <span className="text-sm font-semibold text-sidebar-foreground truncate">{titulo || "Valgian"}</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-4">
        {menu.map((grupo) => (
          <div key={grupo.nombre}>
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1">
                {grupo.nombre}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {grupo.opciones.map((opcion) => {
                const href = RUTA_POR_CODIGO[opcion.codigo] ?? "/dashboard";
                const active = pathname === href;
                const Icon = resolveIcon(opcion.icono);
                const link = (
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors",
                      collapsed ? "justify-center" : "",
                      active
                        ? "bg-accent text-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!collapsed && <span className="truncate">{opcion.nombre}</span>}
                  </Link>
                );
                return (
                  <li key={opcion.id}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger render={link} />
                        <TooltipContent side="right" className="text-xs">
                          {opcion.nombre}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <form action={logoutAction} className="border-t border-sidebar-border p-2 shrink-0">
        <button
          type="submit"
          className="w-full flex items-center gap-2.5 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </form>
    </aside>
  );
}
