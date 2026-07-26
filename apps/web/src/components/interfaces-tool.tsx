"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InterfacesPanel } from "@/components/interfaces-panel";
import { InterfazMenuesChecklist } from "@/components/interfaz-menues-checklist";
import { createInterfazAction, updateInterfazAction, deleteInterfazAction } from "@/app/dashboard/interfaces/actions";

interface InterfazRow {
  id: string;
  codigo: string;
  nombre: string;
  fuente: string | null;
  colorPrimario: string | null;
  colorSecundario: string | null;
  titulo: string | null;
  imagenFondo: string | null;
}

interface InterfacesToolProps {
  interfacesIniciales: InterfazRow[];
  canGestionar: boolean;
}

export function InterfacesTool({ interfacesIniciales, canGestionar }: InterfacesToolProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  async function handleSave(
    data: {
      codigo: string;
      nombre: string;
      fuente: string | null;
      colorPrimario: string | null;
      colorSecundario: string | null;
      titulo: string | null;
      imagenFondo: string | null;
    },
    id?: string,
  ) {
    const result = id ? await updateInterfazAction(id, data) : await createInterfazAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDelete(id: string) {
    const result = await deleteInterfazAction(id);
    if (!result.error) {
      router.refresh();
      if (selectedId === id) setSelectedId(null);
    }
    return result;
  }

  const selected = interfacesIniciales.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="flex h-full gap-4">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg">
          {aviso}
        </div>
      )}

      <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-border">
        <InterfacesPanel
          interfaces={interfacesIniciales}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          canGestionar={canGestionar}
          onSinPermiso={avisarSinPermiso}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </aside>

      <div className="flex-1 overflow-hidden rounded-xl border border-border">
        <InterfazMenuesChecklist interfaz={selected} canGestionar={canGestionar} onSinPermiso={avisarSinPermiso} />
      </div>
    </div>
  );
}
