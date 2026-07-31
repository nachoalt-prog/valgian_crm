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
import { procesarUnaGeneracionPendiente, escucharGeneracionesPendientes } from "@valgian/core";

const SEGUNDOS_BARRIDO_SEGURIDAD = 15 * 60;

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
