"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { getPerfilesConEstadoReporteAction, toggleReportePerfilAction } from "@/app/dashboard/reportes-admin/actions";

interface PerfilConEstado {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

interface ReportePerfilesChecklistProps {
  reporteId: string;
  canGestionar: boolean;
  onSinPermiso: () => void;
}

export function ReportePerfilesChecklist({ reporteId, canGestionar, onSinPermiso }: ReportePerfilesChecklistProps) {
  const [perfiles, setPerfiles] = useState<PerfilConEstado[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    getPerfilesConEstadoReporteAction(reporteId).then((res) => {
      if (!cancelado) setPerfiles(res);
    });
    return () => {
      cancelado = true;
    };
  }, [reporteId]);

  async function toggle(perfilId: string, actual: boolean) {
    if (!canGestionar) return onSinPermiso();

    setPendingId(perfilId);
    const nuevoEstado = !actual;
    const result = await toggleReportePerfilAction(reporteId, perfilId, nuevoEstado);
    setPendingId(null);

    if (result.error) {
      onSinPermiso();
      return;
    }
    setPerfiles((prev) => prev?.map((p) => (p.id === perfilId ? { ...p, activo: nuevoEstado } : p)) ?? prev);
  }

  return (
    <section className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3">
        <Users className="size-4 text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-accent">Perfiles con acceso</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {perfiles === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : perfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay perfiles creados todavía.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {perfiles.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={p.activo}
                    disabled={pendingId === p.id}
                    onChange={() => toggle(p.id, p.activo)}
                    className="size-4 accent-primary"
                  />
                  <span className="font-mono text-xs text-primary">[{p.codigo}]</span>
                  <span className="text-sm text-foreground">{p.nombre}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
