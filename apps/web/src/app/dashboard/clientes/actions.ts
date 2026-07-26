"use server";

import {
  listClientesPorLegajo,
  createCliente,
  updateCliente,
  deleteCliente,
  listCaracteres,
  listTiposDocumento,
  listGeneros,
  listProvincias,
  getPermisoParaHerramienta,
  type ClienteInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "LEGAJO_CLI_1";

async function requireAcceso(): Promise<{ error?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const permiso = await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO);
  if (!permiso) return { error: "No tenés acceso a esta herramienta." };

  return { usuarioId: session.usuario.id };
}

async function requireGestion(): Promise<{ error?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const permiso = await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO);
  if (!permiso?.gestionar) return { error: "No tenés permiso de gestión sobre esta herramienta." };

  return { usuarioId: session.usuario.id };
}

export async function listClientesPorLegajoAction(idLegajo: string) {
  const check = await requireAcceso();
  if (check.error) return [];

  return listClientesPorLegajo(idLegajo);
}

export async function getCatalogosClienteAction() {
  const [caracteresList, tiposDocumentoList, generosList, provinciasList] = await Promise.all([
    listCaracteres(),
    listTiposDocumento(),
    listGeneros(),
    listProvincias(),
  ]);
  return { caracteres: caracteresList, tiposDocumento: tiposDocumentoList, generos: generosList, provincias: provinciasList };
}

export async function createClienteAction(data: ClienteInput) {
  const check = await requireGestion();
  if (check.error || !check.usuarioId) return { error: check.error ?? "No autenticado." };

  return createCliente(data, check.usuarioId);
}

export async function updateClienteAction(id: string, data: ClienteInput) {
  const check = await requireGestion();
  if (check.error || !check.usuarioId) return { error: check.error ?? "No autenticado." };

  return updateCliente(id, data, check.usuarioId);
}

export async function deleteClienteAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  return deleteCliente(id);
}
