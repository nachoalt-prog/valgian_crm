"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronDown, LogOut, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIcon } from "@/lib/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { setThemeCookie, type Theme } from "@/lib/theme";
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
  tipos_archivos_adjuntos: "/dashboard/tipos-archivos-adjuntos",
  reportes: "/dashboard/reportes",
  reportes_admin: "/dashboard/reportes-admin",
  monedas: "/dashboard/monedas",
  mensajeria_plantillas: "/dashboard/mensajeria-plantillas",
};

export function AppSidebar({
  menu,
  titulo,
  temaInicial,
}: {
  menu: MenuGrupo[];
  titulo?: string | null;
  temaInicial: Theme;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // Colapso individual por grupo — el botón del grupo siempre se ve, solo se
  // ocultan sus opciones. Todos abiertos por default; solo guarda los cerrados.
  const [gruposCerrados, setGruposCerrados] = useState<Set<string>>(new Set());
  const [tema, setTema] = useState<Theme>(temaInicial);
  const pathname = usePathname();

  // Sin cookie todavía, el layout.tsx pudo haber corregido la clase real del
  // <html> según prefers-color-scheme DESPUÉS del render de este componente
  // (script beforeInteractive) — sincronizamos el estado del switch una vez montado.
  useEffect(() => {
    const claseReal = document.documentElement.classList.contains("light") ? "light" : "dark";
    setTema((prev) => (prev === claseReal ? prev : claseReal));
  }, []);

  function toggleTema() {
    const next: Theme = tema === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.classList.toggle("dark", next === "dark");
    setThemeCookie(next);
    setTema(next);
  }

  function toggleGrupo(nombre: string) {
    setGruposCerrados((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  }

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
        {menu.map((grupo) => {
          const grupoAbierto = !gruposCerrados.has(grupo.nombre);
          return (
          <div key={grupo.nombre}>
            {!collapsed && (
              <button
                type="button"
                onClick={() => toggleGrupo(grupo.nombre)}
                className="flex w-full items-center justify-between px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{grupo.nombre}</span>
                <ChevronDown className={cn("size-3 transition-transform", !grupoAbierto && "-rotate-90")} />
              </button>
            )}
            <ul className={cn("flex flex-col gap-0.5", collapsed ? "" : grupoAbierto ? "" : "hidden")}>
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
          );
        })}
      </nav>

      <div className={cn("border-t border-sidebar-border p-2 shrink-0", collapsed ? "flex flex-col items-center gap-1" : "")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={toggleTema}
                  aria-label={tema === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {tema === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                </button>
              }
            />
            <TooltipContent side="right" className="text-xs">
              {tema === "dark" ? "Modo oscuro" : "Modo claro"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between rounded px-2 py-1.5 mb-1">
            <span className="flex items-center gap-2 text-sm text-sidebar-foreground">
              {tema === "dark" ? <Moon className="size-4 shrink-0" /> : <Sun className="size-4 shrink-0" />}
              {tema === "dark" ? "Modo oscuro" : "Modo claro"}
            </span>
            <Switch checked={tema === "light"} onCheckedChange={toggleTema} aria-label="Modo claro/oscuro" />
          </div>
        )}

        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
