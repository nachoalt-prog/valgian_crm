/**
 * Módulo opcional — ver docs/contracts/modulo.md y docs/domain/cuenta-corriente.md.
 * Primer módulo con tablas propias (schema.ts + migrations/ propias, ADR 0020).
 * Sin rutas/menú/permisos todavía — no hay pantalla para esto en esta fase
 * (Fase 4 pendiente, ver docs/open-issues.md).
 */
export const manifiesto = {
  id: "cuenta-corriente",
  nombre: "Cuenta Corriente",
  version: "0.1.0",
};

/** Lo llama la app anfitriona al arrancar (ver apps/web/src/instrumentation-node.ts) — nunca @valgian/core. */
export function registrar(): void {
  // Sin hooks de arranque todavía — el motor de cálculo (sql/, triggers +
  // PROCEDURE + PROCESOS) no necesita ninguno, ver docs/domain/cuenta-corriente.md.
}
