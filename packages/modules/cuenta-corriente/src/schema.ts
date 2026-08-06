import { pgTable, uuid, text, boolean, integer, doublePrecision, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { productos, cuentas, clientes, tramites, usuarios } from "@valgian/db";

/**
 * Schema propio del módulo Cuenta Corriente (XCC) — primer uso real del
 * mecanismo de ADR 0020 (migraciones propias por módulo). Se aplica contra
 * la MISMA base Postgres del cliente, nunca una base separada. Puede tener
 * FK hacia tablas del core (nunca al revés — ver docs/contracts/modulo.md).
 */

// Extensión 1:1 de PRODUCTOS — config default del tipo de cuenta.
export const xccProductos = pgTable(
  "XCC_PRODUCTOS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idProducto: uuid("ID_PRODUCTO").references(() => productos.id),
    tasaInteres: doublePrecision("TASA_INTERES"),
    saldoMinInteres: doublePrecision("SALDO_MIN_INTERES"),
    gastoMensual: doublePrecision("GASTO_MENSUAL"),
    saldoMinGastoMensual: doublePrecision("SALDO_MIN_GASTO_MENSUAL"),
  },
  (table) => [uniqueIndex("XCC_PRODUCTOS_ID_PRODUCTO_UNIQUE").on(table.idProducto)],
);

// Extensión 1:1 de CUENTAS — overrides opcionales sobre lo de XCC_PRODUCTOS,
// valores "vigentes" denormalizados (la fuente de verdad histórica es
// XCC_CUENTAS_TASA_HISTORICO, para poder recalcular el pasado).
export const xccCuentas = pgTable(
  "XCC_CUENTAS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idCuenta: uuid("ID_CUENTA").references(() => cuentas.id),
    tasaInteres: doublePrecision("TASA_INTERES"),
    saldoMinInteres: doublePrecision("SALDO_MIN_INTERES"),
    gastoMensual: doublePrecision("GASTO_MENSUAL"),
    saldoMinGastoMensual: doublePrecision("SALDO_MIN_GASTO_MENSUAL"),
  },
  (table) => [uniqueIndex("XCC_CUENTAS_ID_CUENTA_UNIQUE").on(table.idCuenta)],
);

// Tasa efectiva de cada cuenta a través del tiempo — necesaria porque el
// motor puede recalcular el pasado (ver docs/domain/cuenta-corriente.md).
// ALTA_FECHA con default: desempate determinista cuando dos filas comparten
// el mismo VIGENTE_DESDE (ej. una corrección posterior con la misma fecha de
// vigencia que la original) — sin esto, fn_xcc_tasa_vigente podía devolver
// cualquiera de las dos de forma no determinística (bug real encontrado con
// tests, ver docs/open-issues.md).
export const xccCuentasTasaHistorico = pgTable("XCC_CUENTAS_TASA_HISTORICO", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idCuenta: uuid("ID_CUENTA").references(() => cuentas.id),
  tasa: doublePrecision("TASA"),
  vigenteDesde: timestamp("VIGENTE_DESDE", { withTimezone: true }),
  altaFecha: timestamp("ALTA_FECHA", { withTimezone: true }).defaultNow(),
});

// Extensión 1:1 de CLIENTES — condición impositiva vigente (denormalizada,
// fuente de verdad histórica es XCC_CLIENTES_CONDICION_HISTORICO).
export const xccClientes = pgTable(
  "XCC_CLIENTES",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idCliente: uuid("ID_CLIENTE").references(() => clientes.id),
    idCondicionImpositiva: uuid("ID_CONDICION_IMPOSITIVA").references(() => xccCondicionesImpositivas.id),
  },
  (table) => [uniqueIndex("XCC_CLIENTES_ID_CLIENTE_UNIQUE").on(table.idCliente)],
);

// Catálogo editable por ABM — reemplaza el FN_XU_RETENCION hardcodeado del
// legacy. Las alícuotas por tipo de retención viven en
// XCC_CONDICIONES_RETENCION (N:M — ver más abajo), no acá: esta tabla ya no
// tiene ninguna columna de alícuota, antes tenía ALICUOTA_GANANCIAS
// hardcodeada 1:1 solo para "Ganancias".
export const xccCondicionesImpositivas = pgTable(
  "XCC_CONDICIONES_IMPOSITIVAS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
  },
  (table) => [uniqueIndex("XCC_CONDICIONES_IMPOSITIVAS_CODIGO_UNIQUE").on(table.codigo)],
);

// Condición impositiva efectiva de cada cliente a través del tiempo —
// necesaria por la misma razón que XCC_CUENTAS_TASA_HISTORICO: si el motor
// recalcula una acreditación vieja, la retención de Ganancias tiene que
// resolverse con la condición vigente EN ESE MOMENTO, no la actual.
// ALTA_FECHA con default: mismo desempate determinista que XCC_CUENTAS_TASA_HISTORICO.
export const xccClientesCondicionHistorico = pgTable("XCC_CLIENTES_CONDICION_HISTORICO", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idCliente: uuid("ID_CLIENTE").references(() => clientes.id),
  idCondicionImpositiva: uuid("ID_CONDICION_IMPOSITIVA").references(() => xccCondicionesImpositivas.id),
  vigenteDesde: timestamp("VIGENTE_DESDE", { withTimezone: true }),
  altaFecha: timestamp("ALTA_FECHA", { withTimezone: true }).defaultNow(),
});

// Catálogo único para TODO tipo de asiento — movimientos reales (depósito,
// extracción...) Y asientos que genera el motor solo (apertura, devengamiento,
// acreditación, cierre). GENERADO_POR_MOTOR distingue cuáles puede elegir un
// usuario/API al cargar un XCC_MOVIMIENTOS manual (ver docs/domain/cuenta-corriente.md).
export const xccTiposMovimientos = pgTable(
  "XCC_TIPOS_MOVIMIENTOS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
    signo: integer("SIGNO"),
    afectaCapital: boolean("AFECTA_CAPITAL"),
    afectaInteres: boolean("AFECTA_INTERES"),
    esDevengamiento: boolean("ES_DEVENGAMIENTO"),
    esAcreditacionInteres: boolean("ES_ACREDITACION_INTERES"),
    orden: integer("ORDEN"),
    generadoPorMotor: boolean("GENERADO_POR_MOTOR"),
  },
  // Sin esto, dos filas con el mismo CODIGO (ej. dos "apertura") dejarían al
  // motor (sql/0003_..., WHERE "CODIGO" = 'apertura') eligiendo una de forma
  // no determinística — recién importa ahora que esto es editable por ABM.
  (table) => [uniqueIndex("XCC_TIPOS_MOVIMIENTOS_CODIGO_UNIQUE").on(table.codigo)],
);

// El movimiento real — depósito, extracción, transferencia, embargo, ajuste.
export const xccMovimientos = pgTable("XCC_MOVIMIENTOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idCuenta: uuid("ID_CUENTA").references(() => cuentas.id),
  idTipoMovimiento: uuid("ID_TIPO_MOVIMIENTO").references(() => xccTiposMovimientos.id),
  fecha: timestamp("FECHA", { withTimezone: true }),
  monto: doublePrecision("MONTO"),
  observaciones: text("OBSERVACIONES"),
  nroRecibo: text("NRO_RECIBO"),
  // Trazabilidad si el movimiento se originó por un trámite (ej. transferencia entre cuentas).
  idTramite: uuid("ID_TRAMITE").references(() => tramites.id),
  // Con default: desempate determinista en sp_xcc_recalcular_cuenta cuando dos
  // movimientos comparten la misma FECHA de negocio (ver nota en XCC_CUENTAS_TASA_HISTORICO).
  altaFecha: timestamp("ALTA_FECHA", { withTimezone: true }).defaultNow(),
  altaUsuario: uuid("ALTA_USUARIO").references(() => usuarios.id),
});

// Catálogo editable por ABM — porcentaje como dato, no delegado a función
// (salvo Ganancias, que resuelve contra XCC_CLIENTES_CONDICION_HISTORICO).
// USA_CONDICION_IMPOSITIVA distingue ese caso como DATO, no comparando
// CODIGO en el motor (ver docs/domain/cuenta-corriente.md).
export const xccTiposRetencion = pgTable(
  "XCC_TIPOS_RETENCION",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
    orden: integer("ORDEN"),
    activa: boolean("ACTIVA"),
    alicuota: doublePrecision("ALICUOTA"),
    usaCondicionImpositiva: boolean("USA_CONDICION_IMPOSITIVA"),
  },
  (table) => [uniqueIndex("XCC_TIPOS_RETENCION_CODIGO_UNIQUE").on(table.codigo)],
);

// Override de alícuota por (condición impositiva, tipo de retención) — que
// exista una fila ES el override; si no existe, se usa el default de
// XCC_TIPOS_RETENCION.ALICUOTA (ver fn_xcc_aplicar_retenciones, sql/0007_...).
// Reemplaza XCC_CONDICIONES_IMPOSITIVAS.ALICUOTA_GANANCIAS (1:1 con
// "Ganancias" únicamente) por un modelo N:M — una condición puede tener
// alícuotas distintas para cualquier cantidad de tipos de retención con
// USA_CONDICION_IMPOSITIVA=true.
export const xccCondicionesRetencion = pgTable(
  "XCC_CONDICIONES_RETENCION",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idCondicionImpositiva: uuid("ID_CONDICION_IMPOSITIVA")
      .notNull()
      .references(() => xccCondicionesImpositivas.id),
    idTipoRetencion: uuid("ID_TIPO_RETENCION")
      .notNull()
      .references(() => xccTiposRetencion.id),
    alicuota: doublePrecision("ALICUOTA").notNull(),
  },
  (table) => [uniqueIndex("XCC_CONDICIONES_RETENCION_CONDICION_RETENCION_UNIQUE").on(table.idCondicionImpositiva, table.idTipoRetencion)],
);

// El libro mayor calculado — reemplaza XU_ACTUALIZACION_SALDOS del legacy,
// sin cursor (ver docs/domain/cuenta-corriente.md: función de ventana + trigger).
export const xccSaldos = pgTable("XCC_SALDOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idCuenta: uuid("ID_CUENTA").references(() => cuentas.id),
  fecha: timestamp("FECHA", { withTimezone: true }),
  idTipoMovimiento: uuid("ID_TIPO_MOVIMIENTO").notNull().references(() => xccTiposMovimientos.id),
  // Null para asientos generados por el motor solo (devengamiento, acreditación...).
  idXccMovimiento: uuid("ID_XCC_MOVIMIENTO").references(() => xccMovimientos.id),
  // Trazabilidad de qué XCC_TIPOS_RETENCION generó este asiento — solo en
  // asientos de retención, null en cualquier otro (ver docs/domain/cuenta-corriente.md).
  idTipoRetencion: uuid("ID_TIPO_RETENCION").references(() => xccTiposRetencion.id),
  concepto: text("CONCEPTO"),
  monto: doublePrecision("MONTO"),
  saldoCapital: doublePrecision("SALDO_CAPITAL"),
  saldoInteres: doublePrecision("SALDO_INTERES"),
  tasaAplicada: doublePrecision("TASA_APLICADA"),
});

// "A esta fecha, la cuenta tiene estos saldos, recalculá todo lo posterior
// desde acá" — mecanismo de primera clase (ex XU_ACTUALIZACION_POR_MIGRA del
// legacy, no solo para migración inicial, también para correcciones manuales).
export const xccCheckpoint = pgTable("XCC_CHECKPOINT", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idCuenta: uuid("ID_CUENTA").references(() => cuentas.id),
  fecha: timestamp("FECHA", { withTimezone: true }),
  saldoCapital: doublePrecision("SALDO_CAPITAL"),
  saldoInteres: doublePrecision("SALDO_INTERES"),
  observaciones: text("OBSERVACIONES"),
  // Con default: desempate determinista si dos checkpoints caen en la misma
  // FECHA (mismo motivo que XCC_CUENTAS_TASA_HISTORICO/XCC_MOVIMIENTOS).
  altaFecha: timestamp("ALTA_FECHA", { withTimezone: true }).defaultNow(),
  altaUsuario: uuid("ALTA_USUARIO").references(() => usuarios.id),
});

// Cola de recálculo pendiente — los triggers de XCC_MOVIMIENTOS/
// XCC_CUENTAS_TASA_HISTORICO/XCC_CHECKPOINT (y el proceso xcc_consolidacion_saldos,
// nocturno) encolan acá en vez de llamar a sp_xcc_recalcular_cuenta directo:
// un recálculo retroactivo viejo puede recorrer miles de días, y hacerlo
// dentro de la misma transacción del INSERT que lo dispara bloquearía a quien
// lo cargó (ver docs/domain/cuenta-corriente.md). ID_CUENTA único: si ya hay un
// pendiente para esa cuenta, se actualiza a la FECHA_DESDE más antigua de las
// dos (dedup) en vez de duplicar filas. El proceso xcc_procesar_recalculos_pendientes
// (cada 2 min, CALL sp_xcc_drenar_recalculos_pendientes) es el único lugar
// que efectivamente llama al motor.
export const xccRecalculoPendiente = pgTable(
  "XCC_RECALCULO_PENDIENTE",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idCuenta: uuid("ID_CUENTA").notNull().references(() => cuentas.id),
    fechaDesde: timestamp("FECHA_DESDE", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("XCC_RECALCULO_PENDIENTE_ID_CUENTA_UNIQUE").on(table.idCuenta)],
);
