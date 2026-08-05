/**
 * Módulo opcional — ver docs/contracts/modulo.md y docs/módulo XCC. Primer
 * módulo con tablas propias (schema.ts + migrations/ propias, ADR 0020).
 * Sin rutas/menú/permisos todavía — no hay pantalla para esto en esta fase
 * (Fase 4 del roadmap en docs/módulo XCC).
 */
export const manifiesto = {
  id: "cuenta-corriente",
  nombre: "Cuenta Corriente",
  version: "0.1.0",
};

/** Lo llama la app anfitriona al arrancar (ver apps/web/src/instrumentation-node.ts) — nunca @valgian/core. */
export function registrar(): void {
  // Sin hooks de arranque todavía — se completa cuando el motor de cálculo
  // (trigger + función de ventana, Fase 3 del roadmap) lo necesite.
}
