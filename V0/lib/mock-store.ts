import { Perfil, Usuario } from './types'

// ── Seed data ──────────────────────────────────────────────────────────────────

export const initialPerfiles: Perfil[] = [
  {
    id: '11111111-0000-0000-0000-000000000001',
    codigo: 'ADM',
    nombre: 'Administrador',
    idInterfaz: null,
    comodin: null,
  },
  {
    id: '11111111-0000-0000-0000-000000000002',
    codigo: 'OPE',
    nombre: 'Operador',
    idInterfaz: null,
    comodin: null,
  },
  {
    id: '11111111-0000-0000-0000-000000000003',
    codigo: 'VIS',
    nombre: 'Visitante',
    idInterfaz: null,
    comodin: null,
  },
]

export const initialUsuarios: Usuario[] = [
  {
    id: '22222222-0000-0000-0000-000000000001',
    idPerfil: '11111111-0000-0000-0000-000000000001',
    username: 'admin',
    passwordHash: '$2b$10$hash_admin',
    token: null,
    tokenExpiracion: null,
    avatarPath: null,
    comodin: null,
  },
  {
    id: '22222222-0000-0000-0000-000000000002',
    idPerfil: '11111111-0000-0000-0000-000000000001',
    username: 'jdoe',
    passwordHash: '$2b$10$hash_jdoe',
    token: null,
    tokenExpiracion: null,
    avatarPath: null,
    comodin: null,
  },
  {
    id: '22222222-0000-0000-0000-000000000003',
    idPerfil: '11111111-0000-0000-0000-000000000002',
    username: 'operador1',
    passwordHash: '$2b$10$hash_op1',
    token: null,
    tokenExpiracion: null,
    avatarPath: null,
    comodin: null,
  },
  {
    id: '22222222-0000-0000-0000-000000000004',
    idPerfil: '11111111-0000-0000-0000-000000000003',
    username: 'visitante',
    passwordHash: '$2b$10$hash_vis',
    token: null,
    tokenExpiracion: null,
    avatarPath: null,
    comodin: null,
  },
]
