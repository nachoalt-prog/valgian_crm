import { eq, and } from "drizzle-orm";
import { db, closeDb, categoriasProductos, productos, monedas, procesos, procesosPasos } from "@valgian/db";
import { xccProductos, xccTiposMovimientos, xccTiposRetencion, xccCondicionesImpositivas } from "./schema";

/**
 * Seed del módulo Cuenta Corriente (XCC) — categoría/producto base (tablas
 * del core) + catálogos propios. Idempotente (patrón ensureX, insert-only —
 * ver ADR 0020 sobre cómo corregir un registro ya sembrado con un parche).
 */

async function ensureCategoriaProducto(codigo: string, nombre: string, modulo: string) {
  const [existente] = await db.select().from(categoriasProductos).where(eq(categoriasProductos.codigo, codigo));
  if (existente) return existente;
  const [creada] = await db.insert(categoriasProductos).values({ codigo, nombre, modulo }).returning();
  return creada;
}

async function ensureProducto(codigo: string, nombre: string, idCategoria: string, idMoneda: string | null) {
  const [existente] = await db.select().from(productos).where(eq(productos.codigo, codigo));
  if (existente) return existente;
  const [creado] = await db.insert(productos).values({ codigo, nombre, idCategoria, idMoneda }).returning();
  return creado;
}

async function ensureXccProducto(idProducto: string) {
  const [existente] = await db.select().from(xccProductos).where(eq(xccProductos.idProducto, idProducto));
  if (existente) return existente;
  const [creado] = await db
    .insert(xccProductos)
    .values({ idProducto, tasaInteres: 0, saldoMinInteres: 0, gastoMensual: 0, saldoMinGastoMensual: 0 })
    .returning();
  return creado;
}

async function ensureTipoMovimiento(params: {
  codigo: string;
  nombre: string;
  signo: number;
  afectaCapital: boolean;
  afectaInteres: boolean;
  esDevengamiento: boolean;
  esAcreditacionInteres: boolean;
  orden: number;
  generadoPorMotor: boolean;
}) {
  const [existente] = await db.select().from(xccTiposMovimientos).where(eq(xccTiposMovimientos.codigo, params.codigo));
  if (existente) return existente;
  const [creado] = await db.insert(xccTiposMovimientos).values(params).returning();
  return creado;
}

async function ensureCondicionImpositiva(codigo: string, nombre: string, alicuotaGanancias: number) {
  const [existente] = await db.select().from(xccCondicionesImpositivas).where(eq(xccCondicionesImpositivas.codigo, codigo));
  if (existente) return existente;
  const [creada] = await db.insert(xccCondicionesImpositivas).values({ codigo, nombre, alicuotaGanancias }).returning();
  return creada;
}

async function ensureTipoRetencion(codigo: string, nombre: string, orden: number, alicuota: number, usaCondicionImpositiva: boolean) {
  const [existente] = await db.select().from(xccTiposRetencion).where(eq(xccTiposRetencion.codigo, codigo));
  if (existente) return existente;
  // activa: false a propósito — no arrancar descontando plata sin que una
  // instalación real lo decida explícitamente (ver docs/domain/cuenta-corriente.md).
  const [creada] = await db
    .insert(xccTiposRetencion)
    .values({ codigo, nombre, orden, activa: false, alicuota, usaCondicionImpositiva })
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
  const categoriaCuentas = await ensureCategoriaProducto("CUENTAS", "Cuentas", "XCC");

  const [monedaArs] = await db.select().from(monedas).where(eq(monedas.codigo, "ARS"));
  const productoCC = await ensureProducto("CC", "Cuenta Corriente en Pesos", categoriaCuentas.id, monedaArs?.id ?? null);
  await ensureXccProducto(productoCC.id);

  // Asientos que genera el motor solo — nunca seleccionables al cargar un movimiento manual.
  await ensureTipoMovimiento({
    codigo: "apertura",
    nombre: "Apertura de cuenta",
    signo: 1,
    afectaCapital: false,
    afectaInteres: false,
    esDevengamiento: false,
    esAcreditacionInteres: false,
    orden: 1,
    generadoPorMotor: true,
  });
  await ensureTipoMovimiento({
    codigo: "devengamiento",
    nombre: "Devengamiento de interés",
    signo: 1,
    afectaCapital: false,
    afectaInteres: true,
    esDevengamiento: true,
    esAcreditacionInteres: false,
    orden: 2,
    generadoPorMotor: true,
  });
  await ensureTipoMovimiento({
    codigo: "acreditacion_intereses",
    nombre: "Acreditación de intereses",
    signo: 1,
    afectaCapital: true,
    afectaInteres: false,
    esDevengamiento: false,
    esAcreditacionInteres: true,
    orden: 3,
    generadoPorMotor: true,
  });
  await ensureTipoMovimiento({
    codigo: "cierre",
    nombre: "Cierre de cuenta",
    signo: 1,
    afectaCapital: false,
    afectaInteres: false,
    esDevengamiento: false,
    esAcreditacionInteres: false,
    orden: 4,
    generadoPorMotor: true,
  });
  await ensureTipoMovimiento({
    codigo: "retencion",
    nombre: "Retención",
    signo: -1,
    afectaCapital: true,
    afectaInteres: false,
    esDevengamiento: false,
    esAcreditacionInteres: false,
    orden: 5,
    generadoPorMotor: true,
  });
  await ensureTipoMovimiento({
    codigo: "checkpoint",
    nombre: "Checkpoint de saldo",
    signo: 1,
    afectaCapital: true,
    afectaInteres: true,
    esDevengamiento: false,
    esAcreditacionInteres: false,
    orden: 6,
    generadoPorMotor: true,
  });

  // Movimientos manuales — seleccionables por un usuario/API al cargar un XCC_MOVIMIENTOS.
  await ensureTipoMovimiento({
    codigo: "deposito",
    nombre: "Depósito",
    signo: 1,
    afectaCapital: true,
    afectaInteres: false,
    esDevengamiento: false,
    esAcreditacionInteres: false,
    orden: 10,
    generadoPorMotor: false,
  });
  await ensureTipoMovimiento({
    codigo: "extraccion",
    nombre: "Extracción",
    signo: -1,
    afectaCapital: true,
    afectaInteres: false,
    esDevengamiento: false,
    esAcreditacionInteres: false,
    orden: 11,
    generadoPorMotor: false,
  });
  await ensureTipoMovimiento({
    codigo: "transferencia_recibida",
    nombre: "Transferencia recibida",
    signo: 1,
    afectaCapital: true,
    afectaInteres: false,
    esDevengamiento: false,
    esAcreditacionInteres: false,
    orden: 12,
    generadoPorMotor: false,
  });
  await ensureTipoMovimiento({
    codigo: "transferencia_emitida",
    nombre: "Transferencia emitida",
    signo: -1,
    afectaCapital: true,
    afectaInteres: false,
    esDevengamiento: false,
    esAcreditacionInteres: false,
    orden: 13,
    generadoPorMotor: false,
  });
  await ensureTipoMovimiento({
    codigo: "embargo",
    nombre: "Embargo",
    signo: -1,
    afectaCapital: true,
    afectaInteres: false,
    esDevengamiento: false,
    esAcreditacionInteres: false,
    orden: 14,
    generadoPorMotor: false,
  });
  await ensureTipoMovimiento({
    codigo: "ajuste",
    nombre: "Ajuste",
    signo: 1,
    afectaCapital: true,
    afectaInteres: false,
    esDevengamiento: false,
    esAcreditacionInteres: false,
    orden: 15,
    generadoPorMotor: false,
  });

  // Mismos 3 casos que el legacy (Responsable Inscripto / No Inscripto / Con certificado).
  await ensureCondicionImpositiva("responsable_inscripto", "Responsable Inscripto", 3);
  await ensureCondicionImpositiva("no_inscripto", "No Inscripto", 10);
  await ensureCondicionImpositiva("con_certificado", "Con certificado", 0);

  await ensureTipoRetencion("itf", "Impuesto a las Transacciones Financieras", 1, 0.6, false);
  // La alícuota de Ganancias no se usa desde acá — se resuelve por XCC_CLIENTES_CONDICION_HISTORICO.
  await ensureTipoRetencion("ganancias", "Impuesto a las Ganancias", 2, 0, true);

  // Cola de recálculo — ver docs/domain/cuenta-corriente.md. Los triggers y el
  // proceso xcc_consolidacion_saldos solo encolan en XCC_RECALCULO_PENDIENTE;
  // xcc_procesar_recalculos_pendientes (abajo) es el único que efectivamente
  // llama al motor (sp_xcc_recalcular_cuenta), vía CALL a
  // sp_xcc_drenar_recalculos_pendientes — 100% base de datos, sin componente
  // de aplicación (ver docs/domain/cuenta-corriente.md, y ADR 0015).
  const procesoConsolidacionSaldos = await ensureProceso({
    codigo: "xcc_consolidacion_saldos",
    nombre: "Consolidación de saldos Cuenta Corriente",
    descripcion: "Todos los días a las 2am, encola un recálculo de toda cuenta XCC abierta — pone al día el devengamiento/acreditación de cuentas sin movimientos recientes.",
    cron: "0 2 * * *",
    reintentoMinutos: 30,
    reintentosMax: 3,
  });
  await ensureProcesoPaso({
    idProceso: procesoConsolidacionSaldos.id,
    orden: 1,
    nombre: "Encolar cuentas XCC abiertas",
    comando: `
      INSERT INTO "XCC_RECALCULO_PENDIENTE" ("ID_CUENTA", "FECHA_DESDE")
      SELECT c."ID", CURRENT_DATE::timestamptz
      FROM "CUENTAS" c
      JOIN "XCC_CUENTAS" xc ON xc."ID_CUENTA" = c."ID"
      JOIN "ESTADOS" e ON e."ID" = c."ID_ESTADO"
      WHERE e."CODIGO" = 'abierta'
      ON CONFLICT ("ID_CUENTA") DO UPDATE
        SET "FECHA_DESDE" = LEAST("XCC_RECALCULO_PENDIENTE"."FECHA_DESDE", EXCLUDED."FECHA_DESDE")
    `,
    timeoutMinutos: 10,
  });

  const procesoProcesarPendientes = await ensureProceso({
    codigo: "xcc_procesar_recalculos_pendientes",
    nombre: "Procesamiento de recálculos pendientes — Cuenta Corriente",
    descripcion: "Cada 2 minutos, procesa XCC_RECALCULO_PENDIENTE — recalcula cada cuenta pendiente (encolada por un movimiento/tasa/checkpoint nuevo, o por la Consolidación de saldos nocturna) y la saca de la cola.",
    cron: "*/2 * * * *",
    reintentoMinutos: 5,
    reintentosMax: 3,
  });
  await ensureProcesoPaso({
    idProceso: procesoProcesarPendientes.id,
    orden: 1,
    nombre: "Recalcular cuentas pendientes",
    comando: `CALL sp_xcc_drenar_recalculos_pendientes()`,
    timeoutMinutos: 15,
  });

  console.log("Seed de cuenta-corriente aplicado (idempotente).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
