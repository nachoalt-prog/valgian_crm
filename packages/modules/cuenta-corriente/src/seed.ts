import { eq, and, isNull } from "drizzle-orm";
import {
  db,
  closeDb,
  categoriasProductos,
  productos,
  monedas,
  procesos,
  procesosPasos,
  perfiles,
  herramientas,
  operaciones,
  permisos,
  layoutsLegajo,
  layoutsLegajoSolapas,
  filtros,
  bandejas,
  bandejasFiltros,
  bandejasPerfiles,
} from "@valgian/db";
import { xccProductos, xccTiposMovimientos, xccTiposRetencion, xccCondicionesImpositivas } from "./schema";

/**
 * Seed del módulo Cuenta Corriente (XCC) — categoría/producto base (tablas
 * del core) + catálogos propios + la solapa de legajo/bandeja/layout propios
 * del módulo. Idempotente (patrón ensureX, insert-only — ver ADR 0020 sobre
 * cómo corregir un registro ya sembrado con un parche).
 *
 * Requiere haber corrido "pnpm db:seed" y "pnpm db:seed:config" del core
 * antes (necesita PERFILES, LAYOUTS_LEGAJO "layout_legajo_default_1" y los
 * FILTROS de la bandeja "legajos" ya sembrados).
 *
 * Nada de esto se siembra desde packages/core — @valgian/core no puede
 * depender de ningún módulo opcional (docs/contracts/modulo.md), y la
 * bandeja "Legajos CC" de acá abajo referencia XCC_CUENTAS en su QUERY, así
 * que ni la herramienta ni el layout ni la bandeja pueden vivir en el core.
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

async function getPerfilAdmin() {
  const [admin] = await db.select().from(perfiles).where(eq(perfiles.codigo, "admin"));
  if (!admin) throw new Error('No existe PERFILES.CODIGO = "admin" — corré el seed principal ("pnpm db:seed") primero.');
  return admin;
}

async function ensureHerramienta(codigo: string, nombre: string, slug: string) {
  const [existente] = await db.select().from(herramientas).where(eq(herramientas.codigo, codigo));
  if (existente) return existente;
  const [creada] = await db.insert(herramientas).values({ codigo, nombre, slug }).returning();
  return creada;
}

async function ensureOperacion(idHerramienta: string, codigo: string, nombre: string) {
  const [existente] = await db
    .select()
    .from(operaciones)
    .where(and(eq(operaciones.idHerramienta, idHerramienta), eq(operaciones.codigo, codigo)));
  if (existente) return existente;
  const [creada] = await db.insert(operaciones).values({ idHerramienta, codigo, nombre }).returning();
  return creada;
}

async function ensurePermisoOperacion(idPerfil: string, idOperacion: string) {
  const [existente] = await db
    .select()
    .from(permisos)
    .where(and(eq(permisos.idPerfil, idPerfil), eq(permisos.idOperacion, idOperacion)));
  if (existente) return existente;
  const [creado] = await db.insert(permisos).values({ idPerfil, idOperacion }).returning();
  return creado;
}

async function getLayoutPorCodigo(codigo: string) {
  const [layout] = await db.select().from(layoutsLegajo).where(eq(layoutsLegajo.codigo, codigo));
  if (!layout) throw new Error(`No existe LAYOUTS_LEGAJO.CODIGO = "${codigo}" — corré "pnpm db:seed:config" del core primero.`);
  return layout;
}

// A diferencia del ensureX insert-only de siempre, este devuelve también si
// la fila fue creada recién — el clon de solapas de más abajo lo necesita
// para copiar las solapas del default UNA sola vez, no en cada corrida.
async function ensureLayout(codigo: string, nombre: string) {
  const [existente] = await db.select().from(layoutsLegajo).where(eq(layoutsLegajo.codigo, codigo));
  if (existente) return { layout: existente, creado: false as const };
  const [creado] = await db.insert(layoutsLegajo).values({ codigo, nombre }).returning();
  return { layout: creado, creado: true as const };
}

async function ensureLayoutSolapa(idLayout: string, orden: number, nombre: string, idHerramienta: string | null, visible: boolean) {
  const [existente] = await db
    .select()
    .from(layoutsLegajoSolapas)
    .where(and(eq(layoutsLegajoSolapas.idLayout, idLayout), eq(layoutsLegajoSolapas.orden, orden)));
  if (existente) return existente;
  const [creada] = await db.insert(layoutsLegajoSolapas).values({ idLayout, orden, nombre, idHerramienta, visible }).returning();
  return creada;
}

async function ensureFiltro(codigo: string, nombre: string, tipo: string, query: string | null) {
  const [existente] = await db.select().from(filtros).where(eq(filtros.codigo, codigo));
  if (existente) return existente;
  const [creado] = await db.insert(filtros).values({ codigo, nombre, tipo, query }).returning();
  return creado;
}

async function ensureBandeja(codigo: string, nombre: string, query: string, columnas: unknown) {
  const [existente] = await db.select().from(bandejas).where(eq(bandejas.codigo, codigo));
  if (existente) return existente;
  const [creada] = await db.insert(bandejas).values({ codigo, nombre, query, columnas }).returning();
  return creada;
}

async function ensureBandejaFiltro(idBandeja: string, idFiltro: string, campo: string, orden: number) {
  const [existente] = await db
    .select()
    .from(bandejasFiltros)
    .where(and(eq(bandejasFiltros.idBandeja, idBandeja), eq(bandejasFiltros.idFiltro, idFiltro), eq(bandejasFiltros.campo, campo)));
  if (existente) return existente;
  const [creada] = await db.insert(bandejasFiltros).values({ idBandeja, idFiltro, campo, orden }).returning();
  return creada;
}

async function ensureBandejaPerfil(idBandeja: string, idPerfil: string) {
  const [existente] = await db
    .select()
    .from(bandejasPerfiles)
    .where(and(eq(bandejasPerfiles.idBandeja, idBandeja), eq(bandejasPerfiles.idPerfil, idPerfil)));
  if (existente) return existente;
  const [creada] = await db.insert(bandejasPerfiles).values({ idBandeja, idPerfil }).returning();
  return creada;
}

async function ensureBandejaLayout(idBandeja: string, idLayout: string) {
  await db.update(bandejas).set({ idLayout }).where(and(eq(bandejas.id, idBandeja), isNull(bandejas.idLayout)));
}

const BANDEJA_LEGAJOS_CC_QUERY = `
SELECT
  L."ID" AS id,
  L."NUMERO" AS numero,
  C."APELLIDO" || ', ' || C."NOMBRE" AS titular,
  TD."CODIGO" || ': ' || C."NRO_DOCUMENTO" AS documento,
  E."NOMBRE" AS estado,
  E."ID" AS estado_id,
  L."ALTA_FECHA" AS alta_fecha,
  L."ALTA_USUARIO" AS alta_usuario_id,
  C."APELLIDO" AS titular_apellido,
  C."NOMBRE" AS titular_nombre,
  C."NRO_DOCUMENTO" AS titular_documento
FROM "LEGAJOS" L
LEFT JOIN "CLIENTES" C ON C."ID_LEGAJO" = L."ID" AND C."ES_TITULAR" = true
LEFT JOIN "ESTADOS" E ON E."ID" = L."ID_ESTADO"
LEFT JOIN "TIPOS_DOCUMENTO" TD ON TD."ID" = C."ID_TIPO_DOCUMENTO"
WHERE EXISTS (
  SELECT 1 FROM "CUENTAS" CU
  JOIN "XCC_CUENTAS" XC ON XC."ID_CUENTA" = CU."ID"
  WHERE CU."ID_LEGAJO" = L."ID"
)
`.trim();

// Idéntica a BANDEJA_LEGAJOS_COLUMNAS del core (packages/core/src/seed-config.ts) —
// mismos alias de salida de arriba, la query solo agrega el WHERE EXISTS.
const BANDEJA_LEGAJOS_CC_COLUMNAS = [
  { campo: "numero", label: "Nro. Legajo" },
  { campo: "titular", label: "Titular" },
  { campo: "documento", label: "Documento" },
  { campo: "estado", label: "Estado", tipo: "badge" },
  { campo: "alta_fecha", label: "Alta", tipo: "fecha" },
];

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

  // --- Solapa de legajo "Cuenta Corriente" + layout/bandeja propios del
  // módulo. Nunca se toca layout_legajo_default_1 ni la bandeja "legajos"
  // del core — ver docs/domain/cuenta-corriente.md.
  const herramientaResumen = await ensureHerramienta("XCC_RESUMEN_1", "Cuenta Corriente (Legajo)", "xcc_resumen_1.ver");
  const perfilAdmin = await getPerfilAdmin();
  const operacionAccesoResumen = await ensureOperacion(herramientaResumen.id, "acceso", "Acceso");
  await ensurePermisoOperacion(perfilAdmin.id, operacionAccesoResumen.id);

  const layoutDefault = await getLayoutPorCodigo("layout_legajo_default_1");
  const { layout: layoutXcc, creado: layoutXccCreado } = await ensureLayout("layout_legajo_xcc_1", "Layout Legajo — Cuenta Corriente");
  if (layoutXccCreado) {
    // Clon dinámico de lo que el default tenga HOY, no hardcodea las 6
    // solapas actuales — corre una sola vez (guardado por layoutXccCreado).
    const solapasDefault = await db.select().from(layoutsLegajoSolapas).where(eq(layoutsLegajoSolapas.idLayout, layoutDefault.id));
    for (const s of solapasDefault) {
      if (s.orden === null) continue; // ORDEN es nullable en el schema pero siempre viene seteado en la práctica.
      await ensureLayoutSolapa(layoutXcc.id, s.orden, s.nombre, s.idHerramienta, s.visible ?? true);
    }
  }
  await ensureLayoutSolapa(layoutXcc.id, 7, "Cuenta Corriente", herramientaResumen.id, true);

  // Mismos 7 filtros que la bandeja "legajos" del core (packages/core/src/seed-config.ts) —
  // ensureFiltro es idempotente por código, así que esto resuelve a las
  // MISMAS filas ya sembradas por el core, no las duplica.
  const filtroNumero = await ensureFiltro("numero_legajo", "Nro. Legajo", "texto_like", null);
  const filtroEstado = await ensureFiltro(
    "select_estados_legajos",
    "Estado (Legajo)",
    "select",
    `SELECT "ID" AS value, "NOMBRE" AS label FROM "ESTADOS" WHERE "ID_ESTRATEGIA" = (SELECT "ID" FROM "ESTRATEGIAS" WHERE "CODIGO" = 'STD_LEGAJO_1') ORDER BY "NOMBRE"`,
  );
  const filtroFechaAlta = await ensureFiltro("fecha_alta", "Fecha de Alta", "fecha_rango", null);
  const filtroUsuarios = await ensureFiltro(
    "select_usuarios",
    "Usuario",
    "select",
    `SELECT "ID" AS value, "USERNAME" AS label FROM "USUARIOS" ORDER BY "USERNAME"`,
  );
  const filtroApellidoTitular = await ensureFiltro("apellido_titular", "Apellido del Titular (Legajo)", "texto_like", null);
  const filtroNombreTitular = await ensureFiltro("nombre_titular", "Nombre del Titular (Legajo)", "texto_like", null);
  const filtroDocumentoTitular = await ensureFiltro("documento_titular", "Nro. Documento del Titular (Legajo)", "texto_like", null);

  const bandejaLegajosCc = await ensureBandeja("legajos_cc", "Legajos CC", BANDEJA_LEGAJOS_CC_QUERY, BANDEJA_LEGAJOS_CC_COLUMNAS);
  await ensureBandejaFiltro(bandejaLegajosCc.id, filtroNumero.id, "numero", 1);
  await ensureBandejaFiltro(bandejaLegajosCc.id, filtroEstado.id, "estado_id", 2);
  await ensureBandejaFiltro(bandejaLegajosCc.id, filtroFechaAlta.id, "alta_fecha", 3);
  await ensureBandejaFiltro(bandejaLegajosCc.id, filtroUsuarios.id, "alta_usuario_id", 4);
  await ensureBandejaFiltro(bandejaLegajosCc.id, filtroApellidoTitular.id, "titular_apellido", 5);
  await ensureBandejaFiltro(bandejaLegajosCc.id, filtroNombreTitular.id, "titular_nombre", 6);
  await ensureBandejaFiltro(bandejaLegajosCc.id, filtroDocumentoTitular.id, "titular_documento", 7);
  await ensureBandejaLayout(bandejaLegajosCc.id, layoutXcc.id);
  await ensureBandejaPerfil(bandejaLegajosCc.id, perfilAdmin.id);

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
