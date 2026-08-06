import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, cuentas, productos, estados, usuarios, clientes } from "@valgian/db";
import {
  xccCuentas,
  xccCuentasTasaHistorico,
  xccSaldos,
  xccMovimientos,
  xccTiposMovimientos,
  xccTiposRetencion,
  xccClientes,
  xccClientesCondicionHistorico,
  xccCondicionesImpositivas,
} from "./schema";

/**
 * Consultas de solo lectura para la solapa "Cuenta Corriente" de la vista de
 * Legajo (ver docs/domain/cuenta-corriente.md). El capital/interés a mostrar
 * siempre sale de la ÚLTIMA fila de XCC_SALDOS, nunca de XCC_CUENTAS — el
 * motor devenga interés todos los días hábiles, así que "no capitalizado
 * todavía" no es lo mismo que "cero".
 */

const PAGE_SIZE = 20;

export interface XccCuentaResumen {
  idCuenta: string;
  numero: string;
  productoNombre: string;
  altaFecha: Date | null;
  estadoCodigo: string | null;
  estadoNombre: string | null;
  saldoCapital: number;
  saldoInteres: number;
  tasaVigente: number;
}

export interface XccMovimientoFila {
  id: string;
  fecha: Date | null;
  tipoNombre: string | null;
  // Signo del tipo de movimiento (XCC_TIPOS_MOVIMIENTOS.SIGNO) — para colorear
  // por signo (depósito/extracción/etc.) en vez de hardcodear por CODIGO.
  signo: number | null;
  monto: number | null;
  nroRecibo: string | null;
  observaciones: string | null;
  altaUsuarioNombre: string | null;
}

export interface XccTasaHistoricoFila {
  id: string;
  tasa: number | null;
  vigenteDesde: Date | null;
}

export interface XccTitularCondicion {
  idCliente: string;
  clienteNombre: string;
  idCondicionImpositiva: string | null;
  condicionNombre: string | null;
}

export interface XccCondicionHistoricoFila {
  id: string;
  condicionNombre: string | null;
  vigenteDesde: Date | null;
}

export interface XccAsientoFila {
  id: string;
  fecha: Date | null;
  concepto: string | null;
  tipoNombre: string | null;
  signo: number | null;
  generadoPorMotor: boolean | null;
  idTipoRetencion: string | null;
  tipoRetencionNombre: string | null;
  monto: number | null;
  saldoCapital: number | null;
  saldoInteres: number | null;
  tasaAplicada: number | null;
}

export async function getResumenConsolidadoLegajo(
  idLegajo: string,
): Promise<{ cuentas: XccCuentaResumen[]; totalCapital: number; totalInteres: number }> {
  const filasCuentas = await db
    .select({
      idCuenta: cuentas.id,
      numero: cuentas.numero,
      productoNombre: productos.nombre,
      altaFecha: cuentas.altaFecha,
      estadoCodigo: estados.codigo,
      estadoNombre: estados.nombre,
      tasaVigente: xccCuentas.tasaInteres,
    })
    .from(cuentas)
    .innerJoin(xccCuentas, eq(xccCuentas.idCuenta, cuentas.id))
    .leftJoin(productos, eq(productos.id, cuentas.idProducto))
    .leftJoin(estados, eq(estados.id, cuentas.idEstado))
    .where(eq(cuentas.idLegajo, idLegajo));

  if (filasCuentas.length === 0) {
    return { cuentas: [], totalCapital: 0, totalInteres: 0 };
  }

  // Último saldo de cada cuenta — XCC_SALDOS no tiene ALTA_FECHA (a diferencia
  // de XCC_MOVIMIENTOS/históricos), el criterio real del motor es
  // FECHA DESC, ID DESC (ver sql/0003_sp_xcc_recalcular_cuenta.sql).
  const idsCuentas = filasCuentas.map((f) => f.idCuenta);
  const ultimosSaldos = await db
    .selectDistinctOn([xccSaldos.idCuenta], {
      idCuenta: xccSaldos.idCuenta,
      saldoCapital: xccSaldos.saldoCapital,
      saldoInteres: xccSaldos.saldoInteres,
    })
    .from(xccSaldos)
    .where(inArray(xccSaldos.idCuenta, idsCuentas))
    .orderBy(xccSaldos.idCuenta, desc(xccSaldos.fecha), desc(xccSaldos.id));

  const saldoPorCuenta = new Map(ultimosSaldos.map((s) => [s.idCuenta, s]));

  const cuentasResumen: XccCuentaResumen[] = filasCuentas.map((f) => {
    const saldo = saldoPorCuenta.get(f.idCuenta);
    return {
      idCuenta: f.idCuenta,
      numero: f.numero,
      productoNombre: f.productoNombre ?? "—",
      altaFecha: f.altaFecha,
      estadoCodigo: f.estadoCodigo,
      estadoNombre: f.estadoNombre,
      // Cuenta recién abierta sin recálculo drenado todavía (XCC_RECALCULO_PENDIENTE
      // sin procesar) puede no tener ninguna fila en XCC_SALDOS — cae a 0.
      saldoCapital: saldo?.saldoCapital ?? 0,
      saldoInteres: saldo?.saldoInteres ?? 0,
      tasaVigente: f.tasaVigente ?? 0,
    };
  });

  return {
    cuentas: cuentasResumen,
    totalCapital: cuentasResumen.reduce((acc, c) => acc + c.saldoCapital, 0),
    totalInteres: cuentasResumen.reduce((acc, c) => acc + c.saldoInteres, 0),
  };
}

export async function listMovimientosXcc(
  idCuenta: string,
  opts: { desde?: string; hasta?: string; pagina: number },
): Promise<{ rows: XccMovimientoFila[]; hayMas: boolean }> {
  const condiciones = [eq(xccMovimientos.idCuenta, idCuenta)];
  if (opts.desde) condiciones.push(gte(xccMovimientos.fecha, new Date(opts.desde)));
  if (opts.hasta) condiciones.push(lte(xccMovimientos.fecha, new Date(opts.hasta)));

  const filas = await db
    .select({
      id: xccMovimientos.id,
      fecha: xccMovimientos.fecha,
      tipoNombre: xccTiposMovimientos.nombre,
      signo: xccTiposMovimientos.signo,
      monto: xccMovimientos.monto,
      nroRecibo: xccMovimientos.nroRecibo,
      observaciones: xccMovimientos.observaciones,
      altaUsuarioNombre: usuarios.username,
    })
    .from(xccMovimientos)
    .leftJoin(xccTiposMovimientos, eq(xccTiposMovimientos.id, xccMovimientos.idTipoMovimiento))
    .leftJoin(usuarios, eq(usuarios.id, xccMovimientos.altaUsuario))
    .where(and(...condiciones))
    .orderBy(desc(xccMovimientos.fecha), desc(xccMovimientos.altaFecha), desc(xccMovimientos.id))
    // Trae PAGE_SIZE+1 para saber si hay página siguiente sin un COUNT(*) aparte
    // (mismo patrón que buscarReporte, packages/core/src/reportes.ts).
    .limit(PAGE_SIZE + 1)
    .offset(opts.pagina * PAGE_SIZE);

  const hayMas = filas.length > PAGE_SIZE;
  return { rows: hayMas ? filas.slice(0, PAGE_SIZE) : filas, hayMas };
}

export async function listAsientosXcc(
  idCuenta: string,
  opts: { desde?: string; hasta?: string; pagina: number },
): Promise<{ rows: XccAsientoFila[]; hayMas: boolean }> {
  const condiciones = [eq(xccSaldos.idCuenta, idCuenta)];
  if (opts.desde) condiciones.push(gte(xccSaldos.fecha, new Date(opts.desde)));
  if (opts.hasta) condiciones.push(lte(xccSaldos.fecha, new Date(opts.hasta)));

  const filas = await db
    .select({
      id: xccSaldos.id,
      fecha: xccSaldos.fecha,
      concepto: xccSaldos.concepto,
      tipoNombre: xccTiposMovimientos.nombre,
      signo: xccTiposMovimientos.signo,
      generadoPorMotor: xccTiposMovimientos.generadoPorMotor,
      idTipoRetencion: xccSaldos.idTipoRetencion,
      tipoRetencionNombre: xccTiposRetencion.nombre,
      monto: xccSaldos.monto,
      saldoCapital: xccSaldos.saldoCapital,
      saldoInteres: xccSaldos.saldoInteres,
      tasaAplicada: xccSaldos.tasaAplicada,
    })
    .from(xccSaldos)
    .leftJoin(xccTiposMovimientos, eq(xccTiposMovimientos.id, xccSaldos.idTipoMovimiento))
    .leftJoin(xccTiposRetencion, eq(xccTiposRetencion.id, xccSaldos.idTipoRetencion))
    .where(and(...condiciones))
    // Criterio real del motor — XCC_SALDOS no tiene ALTA_FECHA.
    .orderBy(desc(xccSaldos.fecha), desc(xccSaldos.id))
    .limit(PAGE_SIZE + 1)
    .offset(opts.pagina * PAGE_SIZE);

  const hayMas = filas.length > PAGE_SIZE;
  return { rows: hayMas ? filas.slice(0, PAGE_SIZE) : filas, hayMas };
}

/**
 * Cambia la tasa vigente de una cuenta. Dos escrituras en una transacción:
 * XCC_CUENTAS_TASA_HISTORICO es la fuente de verdad histórica (dispara el
 * trigger de recálculo, fn_xcc_trigger_tasa_historico) — XCC_CUENTAS.TASA_INTERES
 * es solo la denormalizada "vigente" que lee getResumenConsolidadoLegajo,
 * insertar solo en el histórico sin actualizarla dejaría la card desactualizada.
 * `sql\`now()\`` (no un Date de JS) para coincidir exactamente con el now()
 * que evalúa el trigger dentro de la misma transacción.
 */
export async function actualizarTasaCuenta(idCuenta: string, nuevaTasa: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(xccCuentasTasaHistorico).values({ idCuenta, tasa: nuevaTasa, vigenteDesde: sql`now()` });
    await tx.update(xccCuentas).set({ tasaInteres: nuevaTasa }).where(eq(xccCuentas.idCuenta, idCuenta));
  });
}

export async function listTasaHistoricoCuenta(idCuenta: string): Promise<XccTasaHistoricoFila[]> {
  return db
    .select({ id: xccCuentasTasaHistorico.id, tasa: xccCuentasTasaHistorico.tasa, vigenteDesde: xccCuentasTasaHistorico.vigenteDesde })
    .from(xccCuentasTasaHistorico)
    .where(eq(xccCuentasTasaHistorico.idCuenta, idCuenta))
    .orderBy(desc(xccCuentasTasaHistorico.vigenteDesde), desc(xccCuentasTasaHistorico.id));
}

/**
 * Titular del legajo (CLIENTES con ES_TITULAR=true) + su condición impositiva
 * VIGENTE, leída del cache denormalizado XCC_CLIENTES (mismo rol que
 * XCC_CUENTAS.TASA_INTERES — el histórico completo lo lee
 * fn_xcc_aplicar_retenciones directo de XCC_CLIENTES_CONDICION_HISTORICO,
 * nunca de este cache). null si el legajo no tiene titular cargado todavía.
 */
export async function getTitularCondicionImpositiva(idLegajo: string): Promise<XccTitularCondicion | null> {
  const [fila] = await db
    .select({
      idCliente: clientes.id,
      apellido: clientes.apellido,
      nombre: clientes.nombre,
      idCondicionImpositiva: xccClientes.idCondicionImpositiva,
      condicionNombre: xccCondicionesImpositivas.nombre,
    })
    .from(clientes)
    .leftJoin(xccClientes, eq(xccClientes.idCliente, clientes.id))
    .leftJoin(xccCondicionesImpositivas, eq(xccCondicionesImpositivas.id, xccClientes.idCondicionImpositiva))
    .where(and(eq(clientes.idLegajo, idLegajo), eq(clientes.esTitular, true)));

  if (!fila) return null;
  return {
    idCliente: fila.idCliente,
    clienteNombre: fila.apellido ? `${fila.apellido}, ${fila.nombre}` : fila.nombre,
    idCondicionImpositiva: fila.idCondicionImpositiva,
    condicionNombre: fila.condicionNombre,
  };
}

/**
 * Cambia la condición impositiva vigente de un cliente. Misma forma que
 * actualizarTasaCuenta: XCC_CLIENTES_CONDICION_HISTORICO es la fuente de
 * verdad histórica (dispara fn_xcc_trigger_condicion_historico, que encola
 * recálculo de las cuentas donde este cliente es titular) + XCC_CLIENTES es
 * el cache "vigente" que lee getTitularCondicionImpositiva. A diferencia de
 * XCC_CUENTAS (que siempre existe por el alta de la cuenta), XCC_CLIENTES
 * puede no tener fila todavía la primera vez que se asigna una condición.
 */
export async function actualizarCondicionImpositivaCliente(idCliente: string, idCondicionImpositiva: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(xccClientesCondicionHistorico).values({ idCliente, idCondicionImpositiva, vigenteDesde: sql`now()` });

    const [existente] = await tx.select().from(xccClientes).where(eq(xccClientes.idCliente, idCliente));
    if (existente) {
      await tx.update(xccClientes).set({ idCondicionImpositiva }).where(eq(xccClientes.idCliente, idCliente));
    } else {
      await tx.insert(xccClientes).values({ idCliente, idCondicionImpositiva });
    }
  });
}

export async function listCondicionHistoricoCliente(idCliente: string): Promise<XccCondicionHistoricoFila[]> {
  return db
    .select({
      id: xccClientesCondicionHistorico.id,
      condicionNombre: xccCondicionesImpositivas.nombre,
      vigenteDesde: xccClientesCondicionHistorico.vigenteDesde,
    })
    .from(xccClientesCondicionHistorico)
    .leftJoin(xccCondicionesImpositivas, eq(xccCondicionesImpositivas.id, xccClientesCondicionHistorico.idCondicionImpositiva))
    .where(eq(xccClientesCondicionHistorico.idCliente, idCliente))
    .orderBy(desc(xccClientesCondicionHistorico.vigenteDesde), desc(xccClientesCondicionHistorico.id));
}
