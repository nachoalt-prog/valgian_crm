import { registrarHandlerAccionExterna, procesarComponenteMensajeria } from "@valgian/core";
import { enviarPorTwilio } from "./enviar-twilio";

/** Módulo opcional — ver docs/contracts/modulo.md. Mismo esqueleto que mensajeria-smtp, canal SMS. */
export const manifiesto = {
  id: "mensajeria-twilio",
  nombre: "Mensajería SMS (Twilio)",
  version: "0.1.0",
};

/** Lo llama la app anfitriona al arrancar (ver apps/web/src/instrumentation-node.ts) — nunca @valgian/core. */
export function registrar(): void {
  registrarHandlerAccionExterna("mensajeria_twilio", (fila) => procesarComponenteMensajeria(fila, enviarPorTwilio));
}

export { enviarPorTwilio };
