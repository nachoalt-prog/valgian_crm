"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { LayoutsLegajoPanel } from "@/components/layouts-legajo-panel";
import { LayoutSolapasAdmin } from "@/components/layout-solapas-admin";
import {
  createLayoutLegajoAction,
  updateLayoutLegajoAction,
  deleteLayoutLegajoAction,
} from "@/app/dashboard/layouts-legajo/actions";
import type { LayoutLegajoInput } from "@valgian/core";

interface LayoutRow {
  id: string;
  codigo: string;
  nombre: string;
}

interface HerramientaOption {
  id: string;
  codigo: string;
  nombre: string;
  parametrosEjemplo: unknown;
  parametrosGuia: string | null;
}

interface LayoutsLegajoToolProps {
  layoutsIniciales: LayoutRow[];
  herramientasDisponibles: HerramientaOption[];
  canGestionar: boolean;
}

export function LayoutsLegajoTool({ layoutsIniciales, herramientasDisponibles, canGestionar }: LayoutsLegajoToolProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  async function handleSave(data: LayoutLegajoInput, id?: string) {
    const result = id ? await updateLayoutLegajoAction(id, data) : await createLayoutLegajoAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDelete(id: string) {
    const result = await deleteLayoutLegajoAction(id);
    if (!result.error) {
      router.refresh();
      if (selectedId === id) setSelectedId(null);
    }
    return result;
  }

  const selected = layoutsIniciales.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="flex h-full gap-4">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg">
          {aviso}
        </div>
      )}

      <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-border">
        <LayoutsLegajoPanel
          layouts={layoutsIniciales}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          canGestionar={canGestionar}
          onSinPermiso={avisarSinPermiso}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </aside>

      <div className="flex-1 overflow-hidden rounded-xl border border-border">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <LayoutTemplate className="size-8 opacity-30" />
            <p className="text-sm">Seleccioná un layout para gestionar sus solapas.</p>
          </div>
        ) : (
          <LayoutSolapasAdmin
            key={selected.id}
            idLayout={selected.id}
            herramientasDisponibles={herramientasDisponibles}
            canGestionar={canGestionar}
            onSinPermiso={avisarSinPermiso}
          />
        )}
      </div>
    </div>
  );
}
