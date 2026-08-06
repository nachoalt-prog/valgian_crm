import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, cuentas, productos, estados, usuarios } from "@valgian/db";
import { xccCuentas, xccSaldos, xccMovimientos, xccTiposMovimientos, xccTiposRetencion } from "./schema";

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
  monto: number | null;
  nroRecibo: string | null;
  observaciones: string | null;
  altaUsuarioNombre: string | null;
}

export interface XccAsientoFila {
  id: string;
  fecha: Date | null;
  concepto: string | null;
  tipoNombre: string | null;
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
