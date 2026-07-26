import { eq, and } from "drizzle-orm";
import { db, closeDb, usuarios, caracteres, generos, tiposDocumento, provincias, estrategias, estados, legajos, clientes } from "@valgian/db";

const ADMIN_USERNAME = "admin";

/**
 * Seed de datos ficticios de prueba — no usar en una instalación real. Depende
 * del seed principal (usuario admin, catálogos base) y del seed de
 * configuración modelo (caracteres Secundario/Pariente, estrategia/estado de
 * legajos). Ver docs/desarrollo-local.md, sección "Los 3 seeds".
 */

async function getAdminUsuario() {
  const [admin] = await db.select().from(usuarios).where(eq(usuarios.username, ADMIN_USERNAME));
  if (!admin) {
    throw new Error(`No existe el usuario "${ADMIN_USERNAME}" — corré el seed principal ("pnpm db:seed") primero.`);
  }
  return admin;
}

async function getCaracterPorCodigo(codigo: string) {
  const [caracter] = await db.select().from(caracteres).where(eq(caracteres.codigo, codigo));
  if (!caracter) throw new Error(`No existe CARACTERES.CODIGO = "${codigo}" — corré el seed principal primero.`);
  return caracter;
}

async function getGeneroPorCodigo(codigo: string) {
  const [genero] = await db.select().from(generos).where(eq(generos.codigo, codigo));
  if (!genero) throw new Error(`No existe GENEROS.CODIGO = "${codigo}" — corré el seed principal primero.`);
  return genero;
}

async function getTipoDocumentoPorCodigo(codigo: string) {
  const [tipo] = await db.select().from(tiposDocumento).where(eq(tiposDocumento.codigo, codigo));
  if (!tipo) throw new Error(`No existe TIPOS_DOCUMENTO.CODIGO = "${codigo}" — corré el seed principal primero.`);
  return tipo;
}

async function getProvinciaPorCodigo(codigo: string) {
  const [provincia] = await db.select().from(provincias).where(eq(provincias.codigo, codigo));
  if (!provincia) throw new Error(`No existe PROVINCIAS.CODIGO = "${codigo}" — corré el seed principal primero.`);
  return provincia;
}

async function getEstrategiaPorCodigo(codigo: string) {
  const [estrategia] = await db.select().from(estrategias).where(eq(estrategias.codigo, codigo));
  if (!estrategia) {
    throw new Error(`No existe ESTRATEGIAS.CODIGO = "${codigo}" — corré el seed de configuración ("pnpm db:seed:config") primero.`);
  }
  return estrategia;
}

async function getEstadoInicial(idEstrategia: string) {
  const [estado] = await db
    .select()
    .from(estados)
    .where(and(eq(estados.idEstrategia, idEstrategia), eq(estados.esInicial, true)));
  if (!estado) {
    throw new Error(`No existe un ESTADOS.ES_INICIAL para esa estrategia — corré el seed de configuración primero.`);
  }
  return estado;
}

async function ensureLegajo(numero: string, idEstado: string, idUsuarioAudit: string) {
  const [existente] = await db.select().from(legajos).where(eq(legajos.numero, numero));
  if (existente) return existente;

  const ahora = new Date();
  const [creado] = await db
    .insert(legajos)
    .values({
      numero,
      idEstado,
      altaFecha: ahora,
      altaUsuario: idUsuarioAudit,
      auditFecha: ahora,
      auditUsuario: idUsuarioAudit,
    })
    .returning();
  return creado;
}

async function ensureCliente(params: {
  idLegajo: string;
  idCaracter: string;
  esTitular: boolean;
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
      esTitular: params.esTitular,
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

type Genero = "M" | "F";

interface PersonaDemo {
  apellido: string;
  nombre: string;
  dni: string;
  genero: Genero;
  provincia: string;
}

interface AcompananteDemo extends PersonaDemo {
  caracter: "secundario" | "pariente";
}

const TITULARES: PersonaDemo[] = [
  { apellido: "Gómez", nombre: "Martín", dni: "30111222", genero: "M", provincia: "AR-B" },
  { apellido: "Fernández", nombre: "Lucía", dni: "29888777", genero: "F", provincia: "AR-X" },
  { apellido: "Rodríguez", nombre: "Nicolás", dni: "31456789", genero: "M", provincia: "AR-S" },
  { apellido: "López", nombre: "Camila", dni: "32567890", genero: "F", provincia: "AR-M" },
  { apellido: "Díaz", nombre: "Federico", dni: "28345678", genero: "M", provincia: "AR-B" },
  { apellido: "Martínez", nombre: "Valentina", dni: "33678901", genero: "F", provincia: "AR-X" },
  { apellido: "Pérez", nombre: "Julián", dni: "27234567", genero: "M", provincia: "AR-S" },
  { apellido: "Sánchez", nombre: "Agustina", dni: "34789012", genero: "F", provincia: "AR-M" },
  { apellido: "Romero", nombre: "Tomás", dni: "26123456", genero: "M", provincia: "AR-B" },
  { apellido: "Torres", nombre: "Florencia", dni: "35890123", genero: "F", provincia: "AR-X" },
];

const ACOMPANANTES: AcompananteDemo[] = [
  { apellido: "Gómez", nombre: "Ana", dni: "30111223", genero: "F", provincia: "AR-B", caracter: "pariente" },
  { apellido: "Fernández", nombre: "Pedro", dni: "29888778", genero: "M", provincia: "AR-X", caracter: "secundario" },
  { apellido: "Rodríguez", nombre: "Sofía", dni: "31456790", genero: "F", provincia: "AR-S", caracter: "pariente" },
  { apellido: "López", nombre: "Ignacio", dni: "32567891", genero: "M", provincia: "AR-M", caracter: "secundario" },
  { apellido: "Díaz", nombre: "Carolina", dni: "28345679", genero: "F", provincia: "AR-B", caracter: "pariente" },
  { apellido: "Martínez", nombre: "Bruno", dni: "33678902", genero: "M", provincia: "AR-X", caracter: "secundario" },
  { apellido: "Pérez", nombre: "Milagros", dni: "27234568", genero: "F", provincia: "AR-S", caracter: "pariente" },
  { apellido: "Sánchez", nombre: "Ezequiel", dni: "34789013", genero: "M", provincia: "AR-M", caracter: "secundario" },
  { apellido: "Romero", nombre: "Delfina", dni: "26123457", genero: "F", provincia: "AR-B", caracter: "pariente" },
  { apellido: "Torres", nombre: "Santiago", dni: "35890124", genero: "M", provincia: "AR-X", caracter: "secundario" },
];

async function main() {
  const admin = await getAdminUsuario();
  const estrategiaLegajos = await getEstrategiaPorCodigo("STD_LEGAJO_1");
  const estadoInicial = await getEstadoInicial(estrategiaLegajos.id);

  const caracterTitular = await getCaracterPorCodigo("titular");
  const caracteresPorCodigo = {
    secundario: await getCaracterPorCodigo("secundario"),
    pariente: await getCaracterPorCodigo("pariente"),
  };

  const tipoDocumentoDni = await getTipoDocumentoPorCodigo("DNI");
  const generosPorCodigo = {
    M: await getGeneroPorCodigo("M"),
    F: await getGeneroPorCodigo("F"),
  };

  const provinciasPorCodigo = new Map<string, Awaited<ReturnType<typeof getProvinciaPorCodigo>>>();
  async function provincia(codigo: string) {
    if (!provinciasPorCodigo.has(codigo)) provinciasPorCodigo.set(codigo, await getProvinciaPorCodigo(codigo));
    return provinciasPorCodigo.get(codigo)!;
  }

  for (let i = 0; i < TITULARES.length; i++) {
    const numero = `DEMO-${String(i + 1).padStart(4, "0")}`;
    const legajo = await ensureLegajo(numero, estadoInicial.id, admin.id);

    const titular = TITULARES[i];
    await ensureCliente({
      idLegajo: legajo.id,
      idCaracter: caracterTitular.id,
      esTitular: true,
      idTipoDocumento: tipoDocumentoDni.id,
      nroDocumento: titular.dni,
      apellido: titular.apellido,
      nombre: titular.nombre,
      idGenero: generosPorCodigo[titular.genero].id,
      idProvincia: (await provincia(titular.provincia)).id,
      idUsuarioAudit: admin.id,
    });

    const acompanante = ACOMPANANTES[i];
    await ensureCliente({
      idLegajo: legajo.id,
      idCaracter: caracteresPorCodigo[acompanante.caracter].id,
      esTitular: false,
      idTipoDocumento: tipoDocumentoDni.id,
      nroDocumento: acompanante.dni,
      apellido: acompanante.apellido,
      nombre: acompanante.nombre,
      idGenero: generosPorCodigo[acompanante.genero].id,
      idProvincia: (await provincia(acompanante.provincia)).id,
      idUsuarioAudit: admin.id,
    });
  }

  console.log("Seed de prueba aplicado (idempotente): 10 legajos, 20 clientes.");
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed de prueba:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
