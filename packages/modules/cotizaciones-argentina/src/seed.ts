import { eq, and } from "drizzle-orm";
import { db, closeDb, accionesExternas, procesos, procesosPasos } from "@valgian/db";

/**
 * Seed propio del módulo (ver docs/contracts/modulo.md) — la fila de
 * ACCIONES_EXTERNAS que configura esta consulta puntual contra DolarApi, y el
 * PROCESO que la dispara periódicamente. Separado de
 * packages/core/src/seed-configuracion-argentina.ts a propósito: MONEDAS
 * (core) tiene sentido con o sin este módulo instalado; esta fila y el
 * PROCESO solo tienen sentido SI el módulo está instalado.
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

async function ensureProceso(params: { codigo: string; nombre: string; descripcion?: string; cron: string; reintentoMinutos?: number; reintentosMax?: number }) {
  const [existente] = await db.select().from(procesos).where(eq(procesos.codigo, params.codigo));
  if (existente) return existente;

  const [creado] = await db
    .insert(procesos)
    .values({
      codigo: params.codigo,
      nombre: params.nombre,
      descripcion: params.descripcion ?? null,
      cron: params.cron,
      activo: true,
      reintentoMinutos: params.reintentoMinutos ?? null,
      reintentosMax: params.reintentosMax ?? null,
    })
    .returning();
  return creado;
}

async function ensureProcesoPaso(params: { idProceso: string; orden: number; nombre: string; comando: string; timeoutMinutos?: number }) {
  const [existente] = await db
    .select()
    .from(procesosPasos)
    .where(and(eq(procesosPasos.idProceso, params.idProceso), eq(procesosPasos.orden, params.orden)));
  if (existente) return existente;

  const [creado] = await db
    .insert(procesosPasos)
    .values({
      idProceso: params.idProceso,
      orden: params.orden,
      nombre: params.nombre,
      comando: params.comando,
      timeoutMinutos: params.timeoutMinutos ?? null,
    })
    .returning();
  return creado;
}

async function main() {
  await ensureAccionExterna("consulta_cotizacion_ar", "Consulta de Cotizaciones (DolarApi)", "consulta_cotizacion", {
    reintentosMax: 3,
    reintentosMargen: 15,
  });

  const procesoCotizacion = await ensureProceso({
    codigo: "consultar_cotizacion_dolarapi",
    nombre: "Consultar cotización DolarApi",
    descripcion: "Cada hora, encola un disparo de la consulta de cotizaciones contra DolarApi.",
    cron: "0 * * * *",
    reintentoMinutos: 10,
    reintentosMax: 3,
  });
  await ensureProcesoPaso({
    idProceso: procesoCotizacion.id,
    orden: 1,
    nombre: "Encolar consulta de cotización",
    comando: `INSERT INTO "ACCIONES_EXTERNAS_COLA" ("ID_ACCION_EXTERNA") VALUES ((SELECT "ID" FROM "ACCIONES_EXTERNAS" WHERE "CODIGO" = 'consulta_cotizacion_ar'))`,
    timeoutMinutos: 5,
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
