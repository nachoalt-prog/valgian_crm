"use server";

import {
  getResumenConsolidadoLegajo,
  listMovimientosXcc,
  listAsientosXcc,
  actualizarTasaCuenta,
  listTasaHistoricoCuenta,
  getTitularCondicionImpositiva,
  actualizarCondicionImpositivaCliente,
  listCondicionHistoricoCliente,
  listCondicionesImpositivasAdmin,
} from "@valgian/module-cuenta-corriente";
import { getPermisoParaOperacion, OPERACION_ACCESO, getEntidadPorCodigo, getEstimulosDisponibles, aplicarEstimulo, listHistorial } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "XCC_RESUMEN_1";
// Config/Gestión de cuenta son botones propios dentro de XCC_RESUMEN_1, con
// su propio permiso separado (no reusan GESTION_ENTIDAD_1 — ese es del
// legajo, no de la cuenta — ver docs/domain/cuenta-corriente.md).
const HERRAMIENTA_CONFIG = "XCC_CUENTA_CONFIG_1";
const HERRAMIENTA_GESTION = "XCC_CUENTA_GESTION_1";
// Condición impositiva del titular — botón general del header, no por
// cuenta (dato del cliente, no de una cuenta puntual).
const HERRAMIENTA_CONDICION_CLIENTE = "XCC_CLIENTE_CONDICION_1";

async function checkAcceso() {
  const session = await getCurrentSession();
  if (!session?.perfil) return "No autenticado.";

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return "No tenés acceso a esta herramienta.";

  return null;
}

async function checkOperacion(herramientaCodigo: string, operacionCodigo: string): Promise<{ error?: string; perfilId?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, herramientaCodigo, operacionCodigo);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };

  return { perfilId: session.perfil.id, usuarioId: session.usuario.id };
}

export async function getResumenConsolidadoLegajoAction(idLegajo: string) {
  const error = await checkAcceso();
  if (error) return { error };

  const data = await getResumenConsolidadoLegajo(idLegajo);
  return { data };
}

export async function listMovimientosXccAction(idCuenta: string, desde: string | undefined, hasta: string | undefined, pagina: number) {
  const error = await checkAcceso();
  if (error) return { error };

  const data = await listMovimientosXcc(idCuenta, { desde, hasta, pagina });
  return { data };
}

export async function listAsientosXccAction(idCuenta: string, desde: string | undefined, hasta: string | undefined, pagina: number) {
  const error = await checkAcceso();
  if (error) return { error };

  const data = await listAsientosXcc(idCuenta, { desde, hasta, pagina });
  return { data };
}

/** ID de ENTIDADES para "cuentas" — lo necesitan las actions genéricas del motor de estados (Gestión/Historial). */
export async function getEntidadCuentaAction() {
  const entidad = await getEntidadPorCodigo("cuentas");
  return { data: entidad?.id ?? null };
}

/** Un solo roundtrip para que el tool sepa qué botones mostrar/habilitar, sin pedir permiso por cada card. */
export async function getPermisosCuentaCorrienteAction() {
  const session = await getCurrentSession();
  if (!session?.perfil) {
    return { data: { verConfig: false, editarConfig: false, verGestion: false, gestionar: false, verCondicionCliente: false, editarCondicionCliente: false } };
  }

  const perfilId = session.perfil.id;
  const [verConfig, editarConfig, verGestion, gestionar, verCondicionCliente, editarCondicionCliente] = await Promise.all([
    getPermisoParaOperacion(perfilId, HERRAMIENTA_CONFIG, OPERACION_ACCESO),
    getPermisoParaOperacion(perfilId, HERRAMIENTA_CONFIG, "editar"),
    getPermisoParaOperacion(perfilId, HERRAMIENTA_GESTION, OPERACION_ACCESO),
    getPermisoParaOperacion(perfilId, HERRAMIENTA_GESTION, "gestionar"),
    getPermisoParaOperacion(perfilId, HERRAMIENTA_CONDICION_CLIENTE, OPERACION_ACCESO),
    getPermisoParaOperacion(perfilId, HERRAMIENTA_CONDICION_CLIENTE, "editar"),
  ]);
  return { data: { verConfig, editarConfig, verGestion, gestionar, verCondicionCliente, editarCondicionCliente } };
}

export async function actualizarTasaCuentaAction(idCuenta: string, nuevaTasa: number) {
  const check = await checkOperacion(HERRAMIENTA_CONFIG, "editar");
  if (check.error) return { error: check.error };

  await actualizarTasaCuenta(idCuenta, nuevaTasa);
  return { data: true };
}

export async function getTasaHistoricoCuentaAction(idCuenta: string) {
  const check = await checkOperacion(HERRAMIENTA_CONFIG, OPERACION_ACCESO);
  if (check.error) return { error: check.error };

  const data = await listTasaHistoricoCuenta(idCuenta);
  return { data };
}

export async function getEstimulosDisponiblesCuentaAction(idEntidad: string, idCuenta: string) {
  const check = await checkOperacion(HERRAMIENTA_GESTION, OPERACION_ACCESO);
  if (check.error || !check.perfilId) return { error: check.error ?? "No autenticado." };

  const data = await getEstimulosDisponibles(idEntidad, idCuenta, check.perfilId);
  return { data };
}

export async function aplicarEstimuloCuentaAction(idEntidad: string, idCuenta: string, idEstimulo: string, observacion: string) {
  const check = await checkOperacion(HERRAMIENTA_GESTION, "gestionar");
  if (check.error || !check.usuarioId) return { error: check.error ?? "No autenticado." };

  return aplicarEstimulo(idEntidad, idCuenta, idEstimulo, check.usuarioId, observacion || null);
}

export async function listHistorialCuentaAction(idEntidad: string, idCuenta: string) {
  const check = await checkOperacion(HERRAMIENTA_GESTION, OPERACION_ACCESO);
  if (check.error) return { error: check.error };

  const data = await listHistorial(idEntidad, idCuenta);
  return { data };
}

export async function getTitularCondicionImpositivaAction(idLegajo: string) {
  const check = await checkOperacion(HERRAMIENTA_CONDICION_CLIENTE, OPERACION_ACCESO);
  if (check.error) return { error: check.error };

  const data = await getTitularCondicionImpositiva(idLegajo);
  return { data };
}

export async function listCondicionesImpositivasDisponiblesAction() {
  const check = await checkOperacion(HERRAMIENTA_CONDICION_CLIENTE, OPERACION_ACCESO);
  if (check.error) return { error: check.error };

  const data = await listCondicionesImpositivasAdmin();
  return { data };
}

export async function actualizarCondicionImpositivaClienteAction(idCliente: string, idCondicionImpositiva: string) {
  const check = await checkOperacion(HERRAMIENTA_CONDICION_CLIENTE, "editar");
  if (check.error) return { error: check.error };

  await actualizarCondicionImpositivaCliente(idCliente, idCondicionImpositiva);
  return { data: true };
}

export async function listCondicionHistoricoClienteAction(idCliente: string) {
  const check = await checkOperacion(HERRAMIENTA_CONDICION_CLIENTE, OPERACION_ACCESO);
  if (check.error) return { error: check.error };

  const data = await listCondicionHistoricoCliente(idCliente);
  return { data };
}
