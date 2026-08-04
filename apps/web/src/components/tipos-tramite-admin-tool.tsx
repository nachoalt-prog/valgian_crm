"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { TiposTramiteAdminPanel } from "@/components/tipos-tramite-admin-panel";
import { TipoTramiteCamposTool } from "@/components/tipo-tramite-campos-tool";
import { crearTipoTramiteAction, actualizarTipoTramiteAction, borrarTipoTramiteAction } from "@/app/dashboard/tipos-tramite/actions";
import type { TipoTramiteInput } from "@valgian/core";

export interface TipoTramiteRow {
  id: string;
  codigo: string;
  nombre: string;
  idCategoria: string | null;
  idEstrategia: string | null;
  idEntidad: string | null;
  filtro: string | null;
  componente: string | null;
}

export interface OpcionSimple {
  id: string;
  codigo: string;
  nombre: string;
}

interface TiposTramiteAdminToolProps {
  tiposIniciales: TipoTramiteRow[];
  categorias: OpcionSimple[];
  estrategias: OpcionSimple[];
  entidades: OpcionSimple[];
  canGestionar: boolean;
}

export function TiposTramiteAdminTool({ tiposIniciales, categorias, estrategias, entidades, canGestionar }: TiposTramiteAdminToolProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  async function handleSave(data: TipoTramiteInput, id?: string) {
    const result = id ? await actualizarTipoTramiteAction(id, data) : await crearTipoTramiteAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDelete(id: string) {
    const result = await borrarTipoTramiteAction(id);
    if (!result.error) {
      router.refresh();
      if (selectedId === id) setSelectedId(null);
    }
    return result;
  }

  const selected = tiposIniciales.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="flex h-full gap-4">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg">
          {aviso}
        </div>
      )}

      <aside className="w-80 shrink-0 overflow-hidden rounded-xl border border-border">
        <TiposTramiteAdminPanel
          tipos={tiposIniciales}
          categorias={categorias}
          estrategias={estrategias}
          entidades={entidades}
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
            <ClipboardList className="size-8 opacity-30" />
            <p className="text-sm">Seleccioná un tipo de trámite para gestionar sus campos.</p>
          </div>
        ) : (
          <div key={selected.id} className="flex h-full flex-col overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">[{selected.codigo}]</span>
                <h2 className="text-sm font-semibold text-foreground">{selected.nombre}</h2>
              </div>
            </div>

            <TipoTramiteCamposTool
              idTipoTramite={selected.id}
              idEstrategia={selected.idEstrategia}
              canGestionar={canGestionar}
              onSinPermiso={avisarSinPermiso}
            />
          </div>
        )}
      </div>
    </div>
  );
}
