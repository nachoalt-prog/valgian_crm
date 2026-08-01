"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MenuesPanel } from "@/components/menues-panel";
import { MenuesOpcionesPanel } from "@/components/menues-opciones-panel";
import type { MenuConContador, MenuOpcionConHerramienta } from "@valgian/core";
import {
  createMenuAction,
  updateMenuAction,
  deleteMenuAction,
  createMenuOpcionAction,
  updateMenuOpcionAction,
  deleteMenuOpcionAction,
} from "@/app/dashboard/menues/actions";

interface HerramientaOption {
  id: string;
  codigo: string;
  nombre: string;
  parametrosEjemplo: unknown;
  parametrosGuia: string | null;
}

interface MenuesToolProps {
  menuesIniciales: MenuConContador[];
  opcionesIniciales: MenuOpcionConHerramienta[];
  herramientas: HerramientaOption[];
  canGestionar: boolean;
}

export function MenuesTool({ menuesIniciales, opcionesIniciales, herramientas, canGestionar }: MenuesToolProps) {
  const router = useRouter();
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  async function handleSaveMenu(data: { codigo: string; nombre: string }, id?: string) {
    const result = id ? await updateMenuAction(id, data) : await createMenuAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDeleteMenu(id: string) {
    const result = await deleteMenuAction(id);
    if (!result.error) {
      router.refresh();
      if (selectedMenuId === id) setSelectedMenuId(null);
    }
    return result;
  }

  async function handleSaveOpcion(
    data: {
      idMenu: string;
      idHerramienta: string | null;
      codigo: string;
      nombre: string;
      icono: string | null;
      orden: number | null;
      parametros: Record<string, unknown> | null;
    },
    id?: string,
  ) {
    const result = id ? await updateMenuOpcionAction(id, data) : await createMenuOpcionAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDeleteOpcion(id: string) {
    const result = await deleteMenuOpcionAction(id);
    if (!result.error) router.refresh();
    return result;
  }

  const selectedMenu = menuesIniciales.find((m) => m.id === selectedMenuId) ?? null;

  return (
    <div className="flex h-full gap-4">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg">
          {aviso}
        </div>
      )}

      <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-border">
        <MenuesPanel
          menues={menuesIniciales}
          selectedMenuId={selectedMenuId}
          onSelectMenu={(id) => setSelectedMenuId((prev) => (prev === id ? null : id))}
          canGestionar={canGestionar}
          onSinPermiso={avisarSinPermiso}
          onSave={handleSaveMenu}
          onDelete={handleDeleteMenu}
        />
      </aside>

      <div className="flex-1 overflow-hidden rounded-xl border border-border">
        <MenuesOpcionesPanel
          opciones={opcionesIniciales}
          selectedMenu={selectedMenu}
          herramientas={herramientas}
          canGestionar={canGestionar}
          onSinPermiso={avisarSinPermiso}
          onSave={handleSaveOpcion}
          onDelete={handleDeleteOpcion}
        />
      </div>
    </div>
  );
}
