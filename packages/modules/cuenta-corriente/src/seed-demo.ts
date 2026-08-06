import { eq, and, sql } from "drizzle-orm";
import { db, closeDb, usuarios, caracteres, generos, tiposDocumento, provincias, estrategias, estados, legajos, clientes, cuentas, productos } from "@valgian/db";
import { xccCuentas, xccCuentasTasaHistorico, xccClientes, xccClientesCondicionHistorico, xccCondicionesImpositivas, xccTiposMovimientos, xccMovimientos, xccSaldos } from "./schema";

const ADMIN_USERNAME = "admin";

/**
 * Seed de datos ficticios de prueba para Cuenta Corriente — no usar en una
 * instalación real (mismo criterio que packages/core/src/seed-demo.ts, ver
 * docs/desarrollo-local.md, sección "Los 3 seeds"). Depende de:
 * - `pnpm db:seed` (core): usuario admin, carácter "titular", tipo de
 *   documento DNI, géneros, provincias.
 * - `pnpm db:seed:config` (core): estrategia/estados STD_CUENTA_1 — el motor
 *   de estados de CUENTAS (ver seed-config.ts, sección "--- Cuentas ---").
 * - `pnpm db:seed` de este módulo: categoría CUENTAS/producto CC, tipos de
 *   movimiento, condiciones impositivas, tipos de retención.
 *
 * Crea UN legajo (DEMO-XCC-0001) con 3 cuentas de Cuenta Corriente — activa
 * con historia, recién abierta, y cerrada — con movimientos de fechas
 * pasadas, y termina llamando `CALL sp_xcc_drenar_recalculos_pendientes()`
 * directo, así XCC_SALDOS queda poblado al terminar el seed — no hace falta
 * esperar al proceso xcc_procesar_recalculos_pendientes (cada 2 min). Un solo
 * legajo con varias cuentas es a propósito: es el escenario que necesita la
 * solapa "Cuenta Corriente" (resumen consolidado por legajo, ver
 * docs/domain/cuenta-corriente.md).
 *
 * Las retenciones (XCC_TIPOS_RETENCION.ACTIVA) NO se tocan acá — activarlas
 * es una decisión de configuración de una instalación real, no algo que un
 * seed de datos de prueba deba forzar (ver seed.ts del módulo). El motor
 * de retenciones ya se verificó por separado con un script scratch.
 */

async function getAdminUsuario() {
  const [admin] = await db.select().from(usuarios).where(eq(usuarios.username, ADMIN_USERNAME));
  if (!admin) throw new Error(`No existe el usuario "${ADMIN_USERNAME}" — corré "pnpm db:seed" primero.`);
  return admin;
}

async function getCaracterPorCodigo(codigo: string) {
  const [caracter] = await db.select().from(caracteres).where(eq(caracteres.codigo, codigo));
  if (!caracter) throw new Error(`No existe CARACTERES.CODIGO = "${codigo}" — corré "pnpm db:seed" primero.`);
  return caracter;
}

async function getGeneroPorCodigo(codigo: string) {
  const [genero] = await db.select().from(generos).where(eq(generos.codigo, codigo));
  if (!genero) throw new Error(`No existe GENEROS.CODIGO = "${codigo}" — corré "pnpm db:seed" primero.`);
  return genero;
}

async function getTipoDocumentoPorCodigo(codigo: string) {
  const [tipo] = await db.select().from(tiposDocumento).where(eq(tiposDocumento.codigo, codigo));
  if (!tipo) throw new Error(`No existe TIPOS_DOCUMENTO.CODIGO = "${codigo}" — corré "pnpm db:seed" primero.`);
  return tipo;
}

async function getProvinciaPorCodigo(codigo: string) {
  const [provincia] = await db.select().from(provincias).where(eq(provincias.codigo, codigo));
  if (!provincia) throw new Error(`No existe PROVINCIAS.CODIGO = "${codigo}" — corré "pnpm db:seed" primero.`);
  return provincia;
}

async function getEstadoAbiertaCuentas() {
  const [estrategia] = await db.select().from(estrategias).where(eq(estrategias.codigo, "STD_CUENTA_1"));
  if (!estrategia) throw new Error(`No existe ESTRATEGIAS.CODIGO = "STD_CUENTA_1" — corré "pnpm db:seed:config" primero.`);
  const [abierta] = await db.select().from(estados).where(and(eq(estados.idEstrategia, estrategia.id), eq(estados.codigo, "abierta")));
  const [cerrada] = await db.select().from(estados).where(and(eq(estados.idEstrategia, estrategia.id), eq(estados.codigo, "cerrada")));
  if (!abierta || !cerrada) throw new Error(`Faltan los estados abierta/cerrada de STD_CUENTA_1 — corré "pnpm db:seed:config" primero.`);
  return { abierta, cerrada };
}

async function getCondicionImpositivaPorCodigo(codigo: string) {
  const [condicion] = await db.select().from(xccCondicionesImpositivas).where(eq(xccCondicionesImpositivas.codigo, codigo));
  if (!condicion) throw new Error(`No existe XCC_CONDICIONES_IMPOSITIVAS.CODIGO = "${codigo}" — corré el seed del módulo primero.`);
  return condicion;
}

async function getTipoMovimientoPorCodigo(codigo: string) {
  const [tipo] = await db.select().from(xccTiposMovimientos).where(eq(xccTiposMovimientos.codigo, codigo));
  if (!tipo) throw new Error(`No existe XCC_TIPOS_MOVIMIENTOS.CODIGO = "${codigo}" — corré el seed del módulo primero.`);
  return tipo;
}

async function ensureLegajo(numero: string, idEstado: string, idUsuarioAudit: string) {
  const [existente] = await db.select().from(legajos).where(eq(legajos.numero, numero));
  if (existente) return existente;

  const ahora = new Date();
  const [creado] = await db
    .insert(legajos)
    .values({ numero, idEstado, altaFecha: ahora, altaUsuario: idUsuarioAudit, auditFecha: ahora, auditUsuario: idUsuarioAudit })
    .returning();
  return creado;
}

async function ensureClienteTitular(params: {
  idLegajo: string;
  idCaracter: string;
  idTipoDocumento: string;
  nroDocumento: string;
  apellido: string;
  nombre: string;
  idGenero: string;
  idProvincia: string;
  idUsuarioAudit: string;
}) {
  const [existente] = await db.select().from(clientes).where(eq(clientes.nroDocumento, params.nroDocumento));
  if (existente) return existente;

  const ahora = new Date();
  const [creado] = await db
    .insert(clientes)
    .values({
      idLegajo: params.idLegajo,
      idCaracter: params.idCaracter,
      esTitular: true,
      idTipoDocumento: params.idTipoDocumento,
      nroDocumento: params.nroDocumento,
      apellido: params.apellido,
      nombre: params.nombre,
      idGenero: params.idGenero,
      idProvincia: params.idProvincia,
      altaFecha: ahora,
      altaUsuario: params.idUsuarioAudit,
      auditFecha: ahora,
      auditUsuario: params.idUsuarioAudit,
    })
    .returning();
  return creado;
}

async function ensureXccCliente(idCliente: string, idCondicionImpositiva: string, vigenteDesde: Date) {
  const [existente] = await db.select().from(xccClientes).where(eq(xccClientes.idCliente, idCliente));
  if (!existente) {
    await db.insert(xccClientes).values({ idCliente, idCondicionImpositiva });
  }

  const [historico] = await db.select().from(xccClientesCondicionHistorico).where(eq(xccClientesCondicionHistorico.idCliente, idCliente));
  if (!historico) {
    await db.insert(xccClientesCondicionHistorico).values({ idCliente, idCondicionImpositiva, vigenteDesde });
  }
}

async function ensureCuentaXcc(params: {
  numero: string;
  idLegajo: string;
  idProducto: string;
  idEstado: string;
  altaFecha: Date;
  idUsuarioAudit: string;
  tasaInteres: number;
}) {
  const [existente] = await db.select().from(cuentas).where(eq(cuentas.numero, params.numero));
  if (existente) return existente;

  const ahora = new Date();
  const [cuenta] = await db
    .insert(cuentas)
    .values({
      idLegajo: params.idLegajo,
      numero: params.numero,
      idProducto: params.idProducto,
      idEstado: params.idEstado,
      altaFecha: params.altaFecha,
      altaUsuario: params.idUsuarioAudit,
      auditFecha: ahora,
      auditUsuario: params.idUsuarioAudit,
    })
    .returning();

  await db.insert(xccCuentas).values({ idCuenta: cuenta.id, tasaInteres: params.tasaInteres, saldoMinInteres: 0, gastoMensual: 0, saldoMinGastoMensual: 0 });
  await db.insert(xccCuentasTasaHistorico).values({ idCuenta: cuenta.id, tasa: params.tasaInteres, vigenteDesde: params.altaFecha });

  return cuenta;
}

async function ensureMovimientosDemo(idCuenta: string, movimientos: { idTipoMovimiento: string; fecha: Date; monto: number; observaciones: string }[]) {
  const [existente] = await db.select().from(xccMovimientos).where(eq(xccMovimientos.idCuenta, idCuenta));
  if (existente) return;

  for (const mov of movimientos) {
    await db.insert(xccMovimientos).values({
      idCuenta,
      idTipoMovimiento: mov.idTipoMovimiento,
      fecha: mov.fecha,
      monto: mov.monto,
      observaciones: mov.observaciones,
    });
  }
}

function haceMeses(n: number, dia = 1): Date {
  const f = new Date();
  f.setUTCMonth(f.getUTCMonth() - n, dia);
  f.setUTCHours(12, 0, 0, 0);
  return f;
}

function haceDias(n: number): Date {
  const f = new Date();
  f.setUTCDate(f.getUTCDate() - n);
  f.setUTCHours(12, 0, 0, 0);
  return f;
}

async function main() {
  const admin = await getAdminUsuario();
  const caracterTitular = await getCaracterPorCodigo("titular");
  const tipoDocumentoDni = await getTipoDocumentoPorCodigo("DNI");
  const generoF = await getGeneroPorCodigo("F");
  const generoM = await getGeneroPorCodigo("M");
  const provinciaCaba = await getProvinciaPorCodigo("AR-C");
  const { abierta: estadoAbierta, cerrada: estadoCerrada } = await getEstadoAbiertaCuentas();

  const [productoCC] = await db.select().from(productos).where(eq(productos.codigo, "CC"));
  if (!productoCC) throw new Error(`No existe PRODUCTOS.CODIGO = "CC" — corré el seed del módulo cuenta-corriente primero.`);

  const condicionResponsableInscripto = await getCondicionImpositivaPorCodigo("responsable_inscripto");

  const tipoDeposito = await getTipoMovimientoPorCodigo("deposito");
  const tipoExtraccion = await getTipoMovimientoPorCodigo("extraccion");

  // Un solo legajo con 3 cuentas (antes eran 3 legajos separados, uno por
  // cuenta — sin motivo real, simplemente no se había pensado el caso
  // "legajo con varias cuentas de Cuenta Corriente", que es justamente lo
  // que necesita probarse la solapa de resumen consolidado del legajo).
  const altaFecha1 = haceMeses(4);
  const legajo1 = await ensureLegajo("DEMO-XCC-0001", estadoAbierta.id, admin.id);
  const titular1 = await ensureClienteTitular({
    idLegajo: legajo1.id,
    idCaracter: caracterTitular.id,
    idTipoDocumento: tipoDocumentoDni.id,
    nroDocumento: "90000001",
    apellido: "González",
    nombre: "Marta",
    idGenero: generoF.id,
    idProvincia: provinciaCaba.id,
    idUsuarioAudit: admin.id,
  });
  await ensureXccCliente(titular1.id, condicionResponsableInscripto.id, altaFecha1);

  // --- Cuenta 1: activa, con varios meses de historia (varias acreditaciones esperadas) ---
  const cuenta1 = await ensureCuentaXcc({
    numero: "DEMO-XCC-0001",
    idLegajo: legajo1.id,
    idProducto: productoCC.id,
    idEstado: estadoAbierta.id,
    altaFecha: altaFecha1,
    idUsuarioAudit: admin.id,
    tasaInteres: 42,
  });
  await ensureMovimientosDemo(cuenta1.id, [
    { idTipoMovimiento: tipoDeposito.id, fecha: haceMeses(4, 2), monto: 500000, observaciones: "Depósito inicial (demo)" },
    { idTipoMovimiento: tipoDeposito.id, fecha: haceMeses(3, 15), monto: 200000, observaciones: "Depósito (demo)" },
    { idTipoMovimiento: tipoExtraccion.id, fecha: haceMeses(2, 10), monto: 150000, observaciones: "Extracción (demo)" },
    { idTipoMovimiento: tipoDeposito.id, fecha: haceMeses(1, 20), monto: 300000, observaciones: "Depósito (demo)" },
  ]);

  // --- Cuenta 2: recién abierta, sin acreditación todavía ---
  const altaFecha2 = haceDias(10);
  const cuenta2 = await ensureCuentaXcc({
    numero: "DEMO-XCC-0002",
    idLegajo: legajo1.id,
    idProducto: productoCC.id,
    idEstado: estadoAbierta.id,
    altaFecha: altaFecha2,
    idUsuarioAudit: admin.id,
    tasaInteres: 38,
  });
  await ensureMovimientosDemo(cuenta2.id, [
    { idTipoMovimiento: tipoDeposito.id, fecha: haceDias(9), monto: 100000, observaciones: "Depósito inicial (demo)" },
  ]);

  // --- Cuenta 3: cerrada (asiento de cierre esperado tras drenar) ---
  const altaFecha3 = haceMeses(3);
  const cuenta3 = await ensureCuentaXcc({
    numero: "DEMO-XCC-0003",
    idLegajo: legajo1.id,
    idProducto: productoCC.id,
    idEstado: estadoCerrada.id,
    altaFecha: altaFecha3,
    idUsuarioAudit: admin.id,
    tasaInteres: 40,
  });
  await ensureMovimientosDemo(cuenta3.id, [
    { idTipoMovimiento: tipoDeposito.id, fecha: haceMeses(3, 2), monto: 250000, observaciones: "Depósito inicial (demo, cuenta luego cerrada)" },
  ]);

  // Las 3 cuentas de arriba encolaron su recálculo solas (triggers de
  // XCC_MOVIMIENTOS/XCC_CUENTAS_TASA_HISTORICO) — se drena acá mismo para que
  // XCC_SALDOS quede poblado al terminar el seed, sin esperar al proceso
  // xcc_procesar_recalculos_pendientes (cada 2 min).
  await db.execute(sql`CALL sp_xcc_drenar_recalculos_pendientes()`);

  const totalAsientos = await db.select().from(xccSaldos);
  console.log(
    `Seed de demo de Cuenta Corriente aplicado (idempotente): legajo DEMO-XCC-0001 con 3 cuentas (0001 activa con historia, 0002 recién abierta, 0003 cerrada), ${totalAsientos.length} asientos totales en XCC_SALDOS tras drenar.`,
  );
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed de demo de Cuenta Corriente:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
