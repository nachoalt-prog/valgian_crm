"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PerfilesPanel } from "@/components/perfiles-panel";
import { UsuariosPanel } from "@/components/usuarios-panel";
import type { PerfilConContador, UsuarioConPerfil } from "@valgian/core";
import {
  createPerfilAction,
  updatePerfilAction,
  deletePerfilAction,
  createUsuarioAction,
  updateUsuarioAction,
  deleteUsuarioAction,
} from "@/app/dashboard/usuarios/actions";

interface InterfazOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface UsuariosPerfilesToolProps {
  perfilesIniciales: PerfilConContador[];
  usuariosIniciales: UsuarioConPerfil[];
  interfaces: InterfazOption[];
  canGestionar: boolean;
}

export function UsuariosPerfilesTool({
  perfilesIniciales,
  usuariosIniciales,
  interfaces,
  canGestionar,
}: UsuariosPerfilesToolProps) {
  const router = useRouter();
  const [selectedPerfilId, setSelectedPerfilId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  async function handleSavePerfil(
    data: { codigo: string; nombre: string; idInterfaz: string | null },
    id?: string,
  ) {
    const result = id ? await updatePerfilAction(id, data) : await createPerfilAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDeletePerfil(id: string) {
    const result = await deletePerfilAction(id);
    if (!result.error) {
      router.refresh();
      if (selectedPerfilId === id) setSelectedPerfilId(null);
    }
    return result;
  }

  async function handleSaveUsuario(
    data: { idPerfil: string | null; username: string; password?: string; avatarPath: string | null },
    id?: string,
  ) {
    const result = id ? await updateUsuarioAction(id, data) : await createUsuarioAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDeleteUsuario(id: string) {
    const result = await deleteUsuarioAction(id);
    if (!result.error) router.refresh();
    return result;
  }

  return (
    <div className="flex h-full gap-4">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg">
          {aviso}
        </div>
      )}

      <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-border">
        <PerfilesPanel
          perfiles={perfilesIniciales}
          selectedPerfilId={selectedPerfilId}
          onSelectPerfil={(id) => setSelectedPerfilId((prev) => (prev === id ? null : id))}
          canGestionar={canGestionar}
          onSinPermiso={avisarSinPermiso}
          interfaces={interfaces}
          onSave={handleSavePerfil}
          onDelete={handleDeletePerfil}
        />
      </aside>

      <div className="flex-1 overflow-hidden rounded-xl border border-border">
        <UsuariosPanel
          perfiles={perfilesIniciales}
          usuarios={usuariosIniciales}
          selectedPerfilId={selectedPerfilId}
          canGestionar={canGestionar}
          onSinPermiso={avisarSinPermiso}
          onSave={handleSaveUsuario}
          onDelete={handleDeleteUsuario}
        />
      </div>
    </div>
  );
}
