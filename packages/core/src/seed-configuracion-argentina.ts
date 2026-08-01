import { eq } from "drizzle-orm";
import { db, closeDb, monedas } from "@valgian/db";

/**
 * Seed de configuración de referencia exclusiva de clientes en Argentina —
 * separado de seed-config.ts (que es genérico, cualquier instalación) a
 * propósito: los tipos de dólar (blue/bolsa/CCL/mayorista) son una
 * particularidad del mercado argentino, no algo que asumir para cualquier
 * cliente. Ver domain/acciones-externas.md.
 *
 * Solo siembra el catálogo de MONEDAS (tabla de core) — la fila de
 * ACCIONES_EXTERNAS que configura la consulta contra DolarApi la siembra el
 * propio módulo opcional (packages/modules/cotizaciones-argentina), no este
 * script: MONEDAS tiene sentido con o sin ese módulo instalado.
 */

async function ensureMoneda(codigo: string, nombre: string, codigoApi: string | null) {
  const [existente] = await db.select().from(monedas).where(eq(monedas.codigo, codigo));
  if (existente) return existente;

  const [creada] = await db.insert(monedas).values({ codigo, nombre, codigoApi }).returning();
  return creada;
}

async function main() {
  await ensureMoneda("ARS", "Peso Argentino", null);
  await ensureMoneda("USD", "Dolar", "oficial");
  await ensureMoneda("USD_BLUE", "Dólar Blue", "blue");
  await ensureMoneda("USD_BOLSA", "Dólar Bolsa", "bolsa");
  await ensureMoneda("USD_CCL", "Dólar CCL", "contadoconliqui");
  await ensureMoneda("USD_MAY", "Dólar Mayorista", "mayorista");

  console.log("Seed de configuración Argentina aplicado (idempotente).");
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed de configuración Argentina:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
