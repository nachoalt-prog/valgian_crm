"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, ChevronRight } from "lucide-react";
import { getMenuesConEstadoAction, toggleInterfazMenuAction } from "@/app/dashboard/interfaces/actions";

interface InterfazRow {
  id: string;
  codigo: string;
  nombre: string;
}

interface MenuConEstado {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

interface InterfazMenuesChecklistProps {
  interfaz: InterfazRow | null;
  canGestionar: boolean;
  onSinPermiso: () => void;
}

export function InterfazMenuesChecklist({ interfaz, canGestionar, onSinPermiso }: InterfazMenuesChecklistProps) {
  if (!interfaz) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <LayoutGrid className="size-8 opacity-30" />
        <p className="text-sm">Seleccioná una interfaz para ver sus menúes.</p>
      </div>
    );
  }

  // key={interfaz.id} en el padre implícito (esta función) fuerza un remount al
  // cambiar de interfaz, así el estado de "cargando" arranca limpio sin useEffect
  // que lo resetee manualmente.
  return <ChecklistCargado key={interfaz.id} interfaz={interfaz} canGestionar={canGestionar} onSinPermiso={onSinPermiso} />;
}

function ChecklistCargado({
  interfaz,
  canGestionar,
  onSinPermiso,
}: {
  interfaz: InterfazRow;
  canGestionar: boolean;
  onSinPermiso: () => void;
}) {
  const [menues, setMenues] = useState<MenuConEstado[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    getMenuesConEstadoAction(interfaz.id).then((res) => {
      if (!cancelado) setMenues(res);
    });
    return () => {
      cancelado = true;
    };
  }, [interfaz.id]);

  async function toggle(menuId: string, actual: boolean) {
    if (!canGestionar) return onSinPermiso();

    setPendingId(menuId);
    const nuevoEstado = !actual;
    const result = await toggleInterfazMenuAction(interfaz.id, menuId, nuevoEstado);
    setPendingId(null);

    if (result.error) {
      onSinPermiso();
      return;
    }
    setMenues((prev) => prev?.map((m) => (m.id === menuId ? { ...m, activo: nuevoEstado } : m)) ?? prev);
  }

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <LayoutGrid className="size-4 shrink-0 text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-accent">Menúes</h2>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-muted-foreground">
          <span className="font-mono text-primary">[{interfaz.codigo}]</span> {interfaz.nombre}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {menues === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : menues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay menúes creados todavía.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {menues.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={m.activo}
                    disabled={pendingId === m.id}
                    onChange={() => toggle(m.id, m.activo)}
                    className="size-4 accent-primary"
                  />
                  <span className="font-mono text-xs text-primary">[{m.codigo}]</span>
                  <span className="text-sm text-foreground">{m.nombre}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
