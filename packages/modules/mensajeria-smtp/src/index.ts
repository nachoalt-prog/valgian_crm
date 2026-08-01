import { registrarHandlerAccionExterna, procesarComponenteMensajeria } from "@valgian/core";
import { enviarPorSmtp } from "./enviar-smtp";

/** Módulo opcional — ver docs/contracts/modulo.md. Segundo módulo real del monorepo (el primero fue cotizaciones-argentina). */
export const manifiesto = {
  id: "mensajeria-smtp",
  nombre: "Mensajería SMTP",
  version: "0.1.0",
};

/** Lo llama la app anfitriona al arrancar (ver apps/web/src/instrumentation-node.ts) — nunca @valgian/core. */
export function registrar(): void {
  registrarHandlerAccionExterna("mensajeria_smtp", (fila) => procesarComponenteMensajeria(fila, enviarPorSmtp));
}

export { enviarPorSmtp };
