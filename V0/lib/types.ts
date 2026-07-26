export interface Perfil {
  id: string
  codigo: string
  nombre: string
  idInterfaz?: string | null
  comodin?: Record<string, unknown> | null
}

export interface Usuario {
  id: string
  idPerfil: string | null
  username: string
  passwordHash: string
  token?: string | null
  tokenExpiracion?: string | null
  avatarPath?: string | null
  comodin?: Record<string, unknown> | null
}

export type PerfilFormData = Omit<Perfil, 'id'>
export type UsuarioFormData = Omit<Usuario, 'id' | 'passwordHash'> & { password?: string }
