import { eq } from "drizzle-orm";
import { db, closeDb, accionesExternas } from "@valgian/db";

/**
 * Seed propio del módulo (ver docs/contracts/modulo.md) — la fila de
 * ACCIONES_EXTERNAS que configura esta consulta puntual contra DolarApi.
 * Separado de packages/core/src/seed-configuracion-argentina.ts a propósito:
 * MONEDAS (core) tiene sentido con o sin este módulo instalado; esta fila
 * solo tiene sentido SI el módulo está instalado.
 */

async function ensureAccionExterna(
  codigo: string,
  nombre: string,
  componente: string,
  opciones: { reintentosMax?: number; reintentosMargen?: number },
) {
  const [existente] = await db.select().from(accionesExternas).where(eq(accionesExternas.codigo, codigo));
  if (existente) return existente;

  const [creada] = await db
    .insert(accionesExternas)
    .values({
      codigo,
      nombre,
      componente,
      reintentosMax: opciones.reintentosMax,
      reintentosMargen: opciones.reintentosMargen,
    })
    .returning();
  return creada;
}

async function main() {
  await ensureAccionExterna("consulta_cotizacion_ar", "Consulta de Cotizaciones (DolarApi)", "consulta_cotizacion", {
    reintentosMax: 3,
    reintentosMargen: 15,
  });

  console.log("Seed de Cotizaciones Argentina aplicado (idempotente).");
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed de Cotizaciones Argentina:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
