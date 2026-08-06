/**
 * Módulo opcional — ver docs/contracts/modulo.md y docs/domain/cuenta-corriente.md.
 * Primer módulo con tablas propias (schema.ts + migrations/ propias, ADR 0020).
 * Primera solapa embebida de legajo (XCC_RESUMEN_1, solo lectura) — el resto
 * de los ABMs de gestión sigue pendiente (Fase 4, ver docs/open-issues.md).
 */
export const manifiesto = {
  id: "cuenta-corriente",
  nombre: "Cuenta Corriente",
  version: "1.0.0",
};

/** Lo llama la app anfitriona al arrancar (ver apps/web/src/instrumentation-node.ts) — nunca @valgian/core. */
export function registrar(): void {
  // Sin hooks de arranque todavía — el motor de cálculo (sql/, triggers +
  // PROCEDURE + PROCESOS) no necesita ninguno, ver docs/domain/cuenta-corriente.md.
}

export { getResumenConsolidadoLegajo, listMovimientosXcc, listAsientosXcc } from "./legajo-resumen";
export type { XccCuentaResumen, XccMovimientoFila, XccAsientoFila } from "./legajo-resumen";
