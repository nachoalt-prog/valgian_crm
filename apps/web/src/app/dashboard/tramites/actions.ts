"use server";

import {
  listCategoriasTiposTramite,
  listTiposTramitePorCategoria,
  listTodosTiposTramite,
  getTipoTramite,
  listTiposTramiteCampos,
  ejecutarListaValores,
  resolverCandidatosAplicarA,
  listTramitesPorLegajo,
  getTramiteDetalle,
  getEstimulosDisponiblesTramite,
  getCabeceraTramite,
  gestionarTramite,
  reconstruirValorCampo,
  mapearValorCampo,
  esValorVacio,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  listUsuarios,
  getEntidadPorCodigo,
  type FiltrosTramitesLegajo,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "TRAMITES_1";

async function requireAcceso(): Promise<{ error?: string; perfilId?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };

  return { perfilId: session.perfil.id, usuarioId: session.usuario.id };
}

/** Para el modal abierto directo desde una bandeja (no hay solapa que ya resuelva esto). */
export async function getPermisoTramitesAction() {
  const session = await getCurrentSession();
  if (!session?.perfil) return { data: false };
  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  return { data: tieneAcceso };
}

/** Para la solapa Historial del Modal de Trámites — HistorialTool necesita el ID real, no el CODIGO. */
export async function getEntidadTramitesIdAction() {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  const entidad = await getEntidadPorCodigo("tramites");
  return { data: entidad?.id ?? null };
}

export async function listCategoriasAction() {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  return { data: await listCategoriasTiposTramite() };
}

export async function listTiposTramitePorCategoriaAction(idCategoria: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  return { data: await listTiposTramitePorCategoria(idCategoria) };
}

export async function getTipoTramiteAction(id: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  return { data: await getTipoTramite(id) };
}

export async function resolverCandidatosAplicarAAction(idTipoTramite: string, idLegajo: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  return { data: await resolverCandidatosAplicarA(idTipoTramite, idLegajo) };
}

export async function listTramitesPorLegajoAction(idLegajo: string, filtros?: FiltrosTramitesLegajo) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  return { data: await listTramitesPorLegajo(idLegajo, filtros) };
}

export async function listTodosTiposTramiteAction() {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  return { data: await listTodosTiposTramite() };
}

export async function listUsuariosAction() {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  return { data: await listUsuarios() };
}

export async function getCamposTramiteAction(idTipoTramite: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  return { data: await listTiposTramiteCampos(idTipoTramite) };
}

export async function getOpcionesListaValoresAction(query: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  return { data: await ejecutarListaValores(query) };
}

export async function getEstimulosDisponiblesTramiteAction(idTipoTramite: string, idTramite: string | null) {
  const check = await requireAcceso();
  if (check.error || !check.perfilId) return { error: check.error ?? "No autenticado." };
  return { data: await getEstimulosDisponiblesTramite(idTipoTramite, idTramite, check.perfilId) };
}

/** Datos fijos (tipo/categoría/entidad) para la cabecera tipo-ticket del Modal de Trámites. */
export async function getCabeceraTramiteAction(idTipoTramite: string, idRegistro: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  return { data: await getCabeceraTramite(idTipoTramite, idRegistro) };
}

/** TRAMITES.NUMERO de un trámite existente — para mostrar en el modal en vez del UUID. */
export async function getNumeroTramiteAction(idTramite: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };
  return { data: (await getTramiteDetalle(idTramite))?.numero ?? null };
}

/** Valores ya reconstruidos (crudos, listos para el formulario) de un trámite existente. */
export async function getValoresParaEditarAction(idTipoTramite: string, idTramite: string) {
  const check = await requireAcceso();
  if (check.error) return { error: check.error };

  const [campos, detalle] = await Promise.all([listTiposTramiteCampos(idTipoTramite), getTramiteDetalle(idTramite)]);
  if (!detalle) return { data: {} as Record<string, unknown> };

  const porCampo = new Map(detalle.valores.map((v) => [v.idTipoTramiteCampo, v]));
  const valores: Record<string, unknown> = {};
  for (const campo of campos) {
    const fila = porCampo.get(campo.id);
    if (fila) valores[campo.id] = reconstruirValorCampo(campo.tipoCampoCodigo, fila);
  }
  return { data: valores };
}

export interface DatoCrudoInput {
  idTipoTramiteCampo: string;
  codigoTipoCampo: string | null;
  valor: unknown;
}

export async function gestionarTramiteAction(input: {
  idTramite?: string | null;
  idTipoTramite: string;
  idRegistro: string;
  datosCrudos: DatoCrudoInput[];
  idEstimulo: string;
  observacion?: string | null;
}) {
  const check = await requireAcceso();
  if (check.error || !check.usuarioId) return { error: check.error ?? "No autenticado." };

  // Defensa en profundidad — el Modal de Trámites ya valida esto del lado del
  // cliente, pero un llamador que se salte esa capa (o un bug futuro ahí) no
  // debería poder dejar guardado un campo obligatorio vacío.
  const campos = await listTiposTramiteCampos(input.idTipoTramite);
  const porId = new Map(input.datosCrudos.map((d) => [d.idTipoTramiteCampo, d.valor]));
  const faltantes = campos.filter((c) => c.obligatorio && esValorVacio(porId.get(c.id), c.tipoCampoCodigo));
  if (faltantes.length > 0) {
    return { error: `Completá los campos obligatorios: ${faltantes.map((c) => c.nombre).join(", ")}.` };
  }

  const datos = input.datosCrudos.map((d) => mapearValorCampo(d.codigoTipoCampo, d.idTipoTramiteCampo, d.valor));
  return gestionarTramite({
    idTramite: input.idTramite,
    idTipoTramite: input.idTipoTramite,
    idRegistro: input.idRegistro,
    datos,
    idEstimulo: input.idEstimulo,
    idUsuario: check.usuarioId,
    observacion: input.observacion,
  });
}
