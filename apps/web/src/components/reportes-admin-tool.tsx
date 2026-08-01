"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { ReportesAdminPanel } from "@/components/reportes-admin-panel";
import { ReporteFiltrosAdmin } from "@/components/reporte-filtros-admin";
import { ReportePerfilesChecklist } from "@/components/reporte-perfiles-checklist";
import { createReporteAction, updateReporteAction, deleteReporteAction } from "@/app/dashboard/reportes-admin/actions";
import type { ReporteInput } from "@valgian/core";

interface ReporteRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  query: string | null;
  columnas: unknown;
}

interface FiltroOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface ReportesAdminToolProps {
  reportesIniciales: ReporteRow[];
  filtrosDisponibles: FiltroOption[];
  canGestionar: boolean;
}

export function ReportesAdminTool({ reportesIniciales, filtrosDisponibles, canGestionar }: ReportesAdminToolProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  async function handleSave(data: ReporteInput, id?: string) {
    const result = id ? await updateReporteAction(id, data) : await createReporteAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDelete(id: string) {
    const result = await deleteReporteAction(id);
    if (!result.error) {
      router.refresh();
      if (selectedId === id) setSelectedId(null);
    }
    return result;
  }

  const selected = reportesIniciales.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex h-full gap-4">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg">
          {aviso}
        </div>
      )}

      <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-border">
        <ReportesAdminPanel
          reportes={reportesIniciales}
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
            <BarChart3 className="size-8 opacity-30" />
            <p className="text-sm">Seleccioná un reporte para gestionar sus filtros y perfiles.</p>
          </div>
        ) : (
          <div key={selected.id} className="flex h-full flex-col overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">[{selected.codigo}]</span>
                <h2 className="text-sm font-semibold text-foreground">{selected.nombre}</h2>
              </div>
              {selected.descripcion && <p className="mt-1 text-xs text-muted-foreground">{selected.descripcion}</p>}
            </div>

            <ReporteFiltrosAdmin
              reporteId={selected.id}
              filtrosDisponibles={filtrosDisponibles}
              canGestionar={canGestionar}
              onSinPermiso={avisarSinPermiso}
            />

            <ReportePerfilesChecklist reporteId={selected.id} canGestionar={canGestionar} onSinPermiso={avisarSinPermiso} />
          </div>
        )}
      </div>
    </div>
  );
}
