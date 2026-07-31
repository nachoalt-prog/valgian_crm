/**
 * Worker de generación de documentos — ver domain/generacion-documentos.md.
 *
 * `register()` corre UNA sola vez por arranque del proceso (Next.js no lo
 * vuelve a llamar en cada hot-reload — validado empíricamente antes de
 * construir esto), lo que lo hace el lugar correcto para abrir una conexión
 * persistente sin repetir el bug de connection-leak-por-hot-reload que ya
 * tuvimos con el pool de Postgres.
 *
 * La lógica real vive en ./instrumentation-node.ts, importado dinámicamente
 * SOLO detrás del chequeo de runtime — ver el comentario ahí para el porqué.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
