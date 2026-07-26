"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { BandejasAdminPanel } from "@/components/bandejas-admin-panel";
import { BandejaFiltrosAdmin } from "@/components/bandeja-filtros-admin";
import { BandejaPerfilesChecklist } from "@/components/bandeja-perfiles-checklist";
import { createBandejaAction, updateBandejaAction, deleteBandejaAction } from "@/app/dashboard/bandejas-admin/actions";
import type { BandejaInput } from "@valgian/core";

interface BandejaRow {
  id: string;
  codigo: string;
  nombre: string;
  query: string | null;
  columnas: unknown;
  idLayout: string | null;
}

interface FiltroOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface LayoutOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface BandejasAdminToolProps {
  bandejasIniciales: BandejaRow[];
  filtrosDisponibles: FiltroOption[];
  layoutsDisponibles: LayoutOption[];
  canGestionar: boolean;
}

export function BandejasAdminTool({ bandejasIniciales, filtrosDisponibles, layoutsDisponibles, canGestionar }: BandejasAdminToolProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  async function handleSave(data: BandejaInput, id?: string) {
    const result = id ? await updateBandejaAction(id, data) : await createBandejaAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDelete(id: string) {
    const result = await deleteBandejaAction(id);
    if (!result.error) {
      router.refresh();
      if (selectedId === id) setSelectedId(null);
    }
    return result;
  }

  const selected = bandejasIniciales.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="flex h-full gap-4">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg">
          {aviso}
        </div>
      )}

      <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-border">
        <BandejasAdminPanel
          bandejas={bandejasIniciales}
          layoutsDisponibles={layoutsDisponibles}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          canGestionar={canGestionar}
          onSinPermiso={avisarSinPermiso}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Inbox className="size-8 opacity-30" />
            <p className="text-sm">Seleccioná una bandeja para gestionar sus filtros y perfiles.</p>
          </div>
        ) : (
          <div key={selected.id} className="flex h-full flex-col overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">[{selected.codigo}]</span>
                <h2 className="text-sm font-semibold text-foreground">{selected.nombre}</h2>
              </div>
            </div>

            <BandejaFiltrosAdmin
              bandejaId={selected.id}
              filtrosDisponibles={filtrosDisponibles}
              canGestionar={canGestionar}
              onSinPermiso={avisarSinPermiso}
            />

            <BandejaPerfilesChecklist bandejaId={selected.id} canGestionar={canGestionar} onSinPermiso={avisarSinPermiso} />
          </div>
        )}
      </div>
    </div>
  );
}
