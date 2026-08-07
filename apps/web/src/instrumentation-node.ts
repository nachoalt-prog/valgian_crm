/**
 * Lógica real del worker — separada de instrumentation.ts a propósito. Next
 * compila instrumentation.ts para runtime "nodejs" Y "edge" a la vez, y el
 * chequeo de `NEXT_RUNTIME` en tiempo de ejecución NO evita que el bundler
 * intente empaquetar los imports pesados (Playwright, argon2 nativo vía
 * @valgian/core) para el bundle de edge — falla en build aunque el código
 * nunca fuera a correr ahí. Separar en un archivo aparte, importado
 * dinámicamente solo del lado nodejs, es el patrón que documenta Next.js
 * para este caso exacto.
 */
import {
  procesarUnaGeneracionPendiente,
  escucharGeneracionesPendientes,
  procesarAccionesExternasPendientes,
  escucharAccionesExternasPendientes,
  registrarMotorImportacion,
  registrarImportadorLegajosClientes,
} from "@valgian/core";
import { registrar as registrarCotizacionesArgentina } from "@valgian/module-cotizaciones-argentina";
import { registrar as registrarMensajeriaSmtp } from "@valgian/module-mensajeria-smtp";
import { registrar as registrarCuentaCorriente } from "@valgian/module-cuenta-corriente";

const SEGUNDOS_BARRIDO_SEGURIDAD = 15 * 60;
const SEGUNDOS_BARRIDO_ACCIONES_EXTERNAS = 60;

// Postgres NO reenvía notificaciones perdidas por una desconexión temporal —
// por eso el barrido periódico no es un nice-to-have, es necesario para no
// dejar una fila pendiente colgada indefinidamente.
async function drenarPendientes(origen: string) {
  try {
    let resultado = await procesarUnaGeneracionPendiente();
    while (resultado.procesada) {
      if (resultado.error) {
        console.error(`[generacion-documentos] Generación ${resultado.id} terminó en error: ${resultado.error}`);
      }
      resultado = await procesarUnaGeneracionPendiente();
    }
  } catch (err) {
    console.error(`[generacion-documentos] Error drenando pendientes (origen: ${origen}):`, err);
  }
}

try {
  await escucharGeneracionesPendientes(() => {
    void drenarPendientes("notify");
  });

  setInterval(() => {
    void drenarPendientes("barrido-seguridad");
  }, SEGUNDOS_BARRIDO_SEGURIDAD * 1000);

  // Por si quedó algo pendiente de antes del último arranque del proceso.
  void drenarPendientes("arranque");

  console.log("[generacion-documentos] Worker iniciado (LISTEN activo, barrido cada 15 min).");
} catch (err) {
  console.error("[generacion-documentos] No se pudo iniciar el worker:", err);
}

// Acciones Externas — ver domain/acciones-externas.md. Mismo patrón que arriba
// (NOTIFY + barrido de seguridad + pasada al arrancar, los 3 llaman al mismo
// barrido), en un try/catch aparte para que una falla acá no tumbe el worker
// de generación de documentos ni viceversa.
async function barrerAccionesExternas(origen: string) {
  try {
    await procesarAccionesExternasPendientes();
  } catch (err) {
    console.error(`[acciones-externas] Error en el barrido (origen: ${origen}):`, err);
  }
}

try {
  // Registro explícito de módulos opcionales (ver docs/contracts/modulo.md) — nada de autodescubrimiento.
  registrarCotizacionesArgentina();
  registrarMensajeriaSmtp();
  registrarCuentaCorriente();
  // Motor de importación (ADR 0021) — infraestructura de core, no un módulo,
  // pero registra su handler ('importacion') con el mismo mecanismo explícito.
  registrarMotorImportacion();
  // Primer importador real (Fase 3) — registro separado del motor genérico,
  // mismo criterio que un módulo: cada cargador se registra por su cuenta.
  registrarImportadorLegajosClientes();

  await escucharAccionesExternasPendientes(() => {
    void barrerAccionesExternas("notify");
  });

  setInterval(() => {
    void barrerAccionesExternas("barrido");
  }, SEGUNDOS_BARRIDO_ACCIONES_EXTERNAS * 1000);

  void barrerAccionesExternas("arranque");

  console.log("[acciones-externas] Worker iniciado (LISTEN activo, barrido cada 1 min).");
} catch (err) {
  console.error("[acciones-externas] No se pudo iniciar el worker:", err);
}
