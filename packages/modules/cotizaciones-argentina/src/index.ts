import { registrarHandlerAccionExterna } from "@valgian/core";
import { consultarCotizacion } from "./consultar-cotizacion";

/**
 * Módulo opcional (ver docs/contracts/modulo.md, docs/decisions/0012-...md) —
 * primer módulo real de este monorepo. Sin rutas/menú/permisos propios
 * todavía (no hay pantalla para esto en este sprint) — el contrato completo
 * de módulo se expande el día que un segundo módulo real lo necesite.
 */
export const manifiesto = {
  id: "cotizaciones-argentina",
  nombre: "Cotizaciones (Argentina)",
  version: "0.1.0",
};

/** Lo llama la app anfitriona al arrancar (ver apps/web/src/instrumentation-node.ts) — nunca @valgian/core. */
export function registrar(): void {
  registrarHandlerAccionExterna("consulta_cotizacion", consultarCotizacion);
}

export { consultarCotizacion };
