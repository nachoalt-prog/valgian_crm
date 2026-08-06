/**
 * Módulo opcional — ver docs/contracts/modulo.md y docs/domain/cuenta-corriente.md.
 * Primer módulo con tablas propias (schema.ts + migrations/ propias, ADR 0020).
 * Primer módulo con entradas de menú propias (ver seed.ts — MENUES/MENUES_OPCIONES,
 * contemplado en docs/contracts/modulo.md pero sin precedente hasta ahora).
 */
export const manifiesto = {
  id: "cuenta-corriente",
  nombre: "Cuenta Corriente",
  version: "1.1.0",
};

/** Lo llama la app anfitriona al arrancar (ver apps/web/src/instrumentation-node.ts) — nunca @valgian/core. */
export function registrar(): void {
  // Sin hooks de arranque todavía — el motor de cálculo (sql/, triggers +
  // PROCEDURE + PROCESOS) no necesita ninguno, ver docs/domain/cuenta-corriente.md.
}

export {
  getResumenConsolidadoLegajo,
  listMovimientosXcc,
  listAsientosXcc,
  actualizarTasaCuenta,
  listTasaHistoricoCuenta,
  getTitularCondicionImpositiva,
  actualizarCondicionImpositivaCliente,
  listCondicionHistoricoCliente,
} from "./legajo-resumen";
export type {
  XccCuentaResumen,
  XccMovimientoFila,
  XccAsientoFila,
  XccTasaHistoricoFila,
  XccTitularCondicion,
  XccCondicionHistoricoFila,
} from "./legajo-resumen";

export {
  listTiposMovimientoAdmin,
  createTipoMovimiento,
  updateTipoMovimiento,
  deleteTipoMovimiento,
  listTiposRetencionAdmin,
  createTipoRetencion,
  updateTipoRetencion,
  deleteTipoRetencion,
  listCondicionesImpositivasAdmin,
  createCondicionImpositiva,
  updateCondicionImpositiva,
  deleteCondicionImpositiva,
  listAlicuotasPorCondicion,
  setAlicuotaCondicionRetencion,
} from "./catalogos";
export type {
  TipoMovimientoCreateInput,
  TipoMovimientoUpdateInput,
  TipoRetencionInput,
  CondicionImpositivaInput,
  AlicuotaPorCondicionFila,
} from "./catalogos";
