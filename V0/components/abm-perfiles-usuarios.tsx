'use client'

import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { PerfilesPanel } from '@/components/perfiles-panel'
import { UsuariosPanel } from '@/components/usuarios-panel'
import { Perfil, Usuario, PerfilFormData, UsuarioFormData } from '@/lib/types'
import { initialPerfiles, initialUsuarios } from '@/lib/mock-store'

export function AbmPerfilesUsuarios() {
  const [perfiles, setPerfiles] = useState<Perfil[]>(initialPerfiles)
  const [usuarios, setUsuarios] = useState<Usuario[]>(initialUsuarios)
  const [selectedPerfilId, setSelectedPerfilId] = useState<string | null>(null)

  // ── Perfiles ────────────────────────────────────────────────────────────────

  const addPerfil = useCallback((data: PerfilFormData) => {
    setPerfiles((prev) => [...prev, { id: uuidv4(), ...data }])
  }, [])

  const editPerfil = useCallback((data: PerfilFormData, id: string) => {
    setPerfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)))
  }, [])

  const deletePerfil = useCallback((id: string) => {
    setPerfiles((prev) => prev.filter((p) => p.id !== id))
    // Desvinculamos usuarios que pertenecían a ese perfil
    setUsuarios((prev) => prev.map((u) => (u.idPerfil === id ? { ...u, idPerfil: null } : u)))
    if (selectedPerfilId === id) setSelectedPerfilId(null)
  }, [selectedPerfilId])

  // ── Usuarios ─────────────────────────────────────────────────────────────────

  const addUsuario = useCallback((data: UsuarioFormData) => {
    setUsuarios((prev) => [
      ...prev,
      {
        id: uuidv4(),
        idPerfil: data.idPerfil ?? null,
        username: data.username,
        passwordHash: data.password ? `$2b$10$hash_${data.password}` : '$2b$10$hash_default',
        token: null,
        tokenExpiracion: null,
        avatarPath: data.avatarPath ?? null,
        comodin: null,
      },
    ])
  }, [])

  const editUsuario = useCallback((data: UsuarioFormData, id: string) => {
    setUsuarios((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u
        return {
          ...u,
          idPerfil: data.idPerfil ?? null,
          username: data.username,
          passwordHash: data.password ? `$2b$10$hash_${data.password}` : u.passwordHash,
          avatarPath: data.avatarPath ?? null,
        }
      })
    )
  }, [])

  const deleteUsuario = useCallback((id: string) => {
    setUsuarios((prev) => prev.filter((u) => u.id !== id))
  }, [])

  const usuariosCount = useCallback(
    (perfilId: string) => usuarios.filter((u) => u.idPerfil === perfilId).length,
    [usuarios]
  )

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <header className="shrink-0 flex items-center gap-3 px-6 py-3.5 border-b border-border bg-card">
        {/* Valgian V logo mark */}
        <div className="w-7 h-7 shrink-0">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <polygon
              points="16,2 30,10 30,22 16,30 2,22 2,10"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              className="text-primary/30"
            />
            <polyline
              points="4,8 16,26 28,8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-widest uppercase text-foreground">Valgian CRM</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Gestión de Perfiles y Usuarios
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {perfiles.length} perfiles · {usuarios.length} usuarios
          </span>
        </div>
      </header>

      {/* Main split */}
      <main className="flex-1 flex overflow-hidden">
        {/* LEFT — Perfiles (fixed width) */}
        <aside className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden bg-card/50">
          <PerfilesPanel
            perfiles={perfiles}
            selectedPerfilId={selectedPerfilId}
            onSelectPerfil={(id) =>
              setSelectedPerfilId((prev) => (prev === id ? null : id))
            }
            onAdd={addPerfil}
            onEdit={editPerfil}
            onDelete={deletePerfil}
            usuariosCount={usuariosCount}
          />
        </aside>

        {/* RIGHT — Usuarios (flex-grow) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <UsuariosPanel
            perfiles={perfiles}
            usuarios={usuarios}
            selectedPerfilId={selectedPerfilId}
            onAdd={addUsuario}
            onEdit={editUsuario}
            onDelete={deleteUsuario}
          />
        </div>
      </main>
    </div>
  )
}
