import { eq, and, sql } from "drizzle-orm";
import {
  db,
  closeDb,
  usuarios,
  caracteres,
  generos,
  tiposDocumento,
  provincias,
  estrategias,
  estados,
  estimulos,
  legajos,
  clientes,
  tramites,
  entidades,
  categoriasTiposTramite,
  tiposTramite,
  tiposCampos,
  tiposTramiteCampos,
} from "@valgian/db";
import { gestionarTramite, mapearValorCampo, type DatoTramiteInput } from "./tramites";

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

async function getEstimuloPorCodigo(idEstrategia: string, codigo: string) {
  const [estimulo] = await db.select().from(estimulos).where(and(eq(estimulos.idEstrategia, idEstrategia), eq(estimulos.codigo, codigo)));
  if (!estimulo) throw new Error(`No existe ESTIMULOS.CODIGO = "${codigo}" para esa estrategia — corré el seed de configuración primero.`);
  return estimulo;
}

async function getLegajoPorNumero(numero: string) {
  const [legajo] = await db.select().from(legajos).where(eq(legajos.numero, numero));
  if (!legajo) throw new Error(`No existe LEGAJOS.NUMERO = "${numero}" — corré este mismo seed antes de la sección de trámites.`);
  return legajo;
}

async function getTitularDelLegajo(idLegajo: string) {
  const [titular] = await db.select().from(clientes).where(and(eq(clientes.idLegajo, idLegajo), eq(clientes.esTitular, true)));
  if (!titular) throw new Error(`No existe un cliente titular para el legajo ${idLegajo}.`);
  return titular;
}

/** Idempotente por (ID_TIPO_TRAMITE, ID_REGISTRO) — no hay unique real en TRAMITES, pero alcanza para el seed. */
async function ensureTramiteDemo(params: {
  idTipoTramite: string;
  idRegistro: string;
  datos: DatoTramiteInput[];
  idEstimulo: string;
  idUsuario: string;
  observacion?: string;
}) {
  const [existente] = await db
    .select()
    .from(tramites)
    .where(and(eq(tramites.idTipoTramite, params.idTipoTramite), eq(tramites.idRegistro, params.idRegistro)));
  if (existente) return existente;

  const resultado = await gestionarTramite({
    idTipoTramite: params.idTipoTramite,
    idRegistro: params.idRegistro,
    datos: params.datos,
    idEstimulo: params.idEstimulo,
    idUsuario: params.idUsuario,
    observacion: params.observacion ?? null,
  });
  if (resultado.error) throw new Error(`Error creando trámite demo: ${resultado.error}`);
  return { id: resultado.data!.idTramite };
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

async function getEntidadPorCodigo(codigo: string) {
  const [entidad] = await db.select().from(entidades).where(eq(entidades.codigo, codigo));
  if (!entidad) throw new Error(`No existe ENTIDADES.CODIGO = "${codigo}" — corré el seed principal primero.`);
  return entidad;
}

async function getTipoCampoPorCodigo(codigo: string) {
  const [tipo] = await db.select().from(tiposCampos).where(eq(tiposCampos.codigo, codigo));
  if (!tipo) throw new Error(`No existe TIPOS_CAMPOS.CODIGO = "${codigo}" — corré el seed de configuración primero.`);
  return tipo;
}

async function ensureCategoriaTipoTramite(codigo: string, nombre: string) {
  const [existente] = await db.select().from(categoriasTiposTramite).where(eq(categoriasTiposTramite.codigo, codigo));
  if (existente) return existente;

  const [creada] = await db.insert(categoriasTiposTramite).values({ codigo, nombre }).returning();
  return creada;
}

async function ensureTipoTramite(params: {
  codigo: string;
  nombre: string;
  idCategoria: string;
  idEstrategia: string;
  idEntidad: string;
  filtro?: string;
}) {
  const [existente] = await db.select().from(tiposTramite).where(eq(tiposTramite.codigo, params.codigo));
  if (existente) return existente;

  const [creado] = await db.insert(tiposTramite).values(params).returning();
  return creado;
}

async function ensureTipoTramiteCampo(params: {
  codigo: string;
  nombre: string;
  idTipoTramite: string;
  idTipoCampo: string;
  orden: number;
  obligatorio?: boolean;
  placeholder?: string;
  numMin?: number;
  listaValores?: string;
}) {
  const [existente] = await db
    .select()
    .from(tiposTramiteCampos)
    .where(and(eq(tiposTramiteCampos.idTipoTramite, params.idTipoTramite), eq(tiposTramiteCampos.codigo, params.codigo)));
  if (existente) return existente;

  const [creado] = await db
    .insert(tiposTramiteCampos)
    .values({ ...params, visible: true, editable: true })
    .returning();
  return creado;
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

  // --- Trámites de prueba ---

  await db.execute(sql`
    CREATE OR REPLACE FUNCTION fn_filtro_tramite_cli_titular_1(ids uuid[])
    RETURNS uuid[]
    LANGUAGE sql
    AS $$
      SELECT COALESCE(array_agg("ID"), ARRAY[]::uuid[])
      FROM "CLIENTES"
      WHERE "ID" = ANY(ids) AND "ES_TITULAR" = true;
    $$;
  `);

  const entidadLegajos = await getEntidadPorCodigo("legajos");
  const entidadClientes = await getEntidadPorCodigo("clientes");
  const estrategiaTramites = await getEstrategiaPorCodigo("STD_TRAMITE_1");

  const categoriaSobreLegajos = await ensureCategoriaTipoTramite("sobre_legajos", "Sobre Legajos");
  const categoriaSobreClientes = await ensureCategoriaTipoTramite("sobre_clientes", "Sobre Clientes");

  const tipoCampoTexto = await getTipoCampoPorCodigo("INPUT_TEXT");
  const tipoCampoFecha = await getTipoCampoPorCodigo("INPUT_DATETIME");
  const tipoCampoSelect = await getTipoCampoPorCodigo("SELECT");
  const tipoCampoCheckbox = await getTipoCampoPorCodigo("INPUT_CHECKBOX");
  const tipoCampoTel = await getTipoCampoPorCodigo("INPUT_TEL");
  const tipoCampoNumero = await getTipoCampoPorCodigo("INPUT_NUMBER");
  const tipoCampoEmail = await getTipoCampoPorCodigo("INPUT_EMAIL");
  const tipoCampoSelectMultiple = await getTipoCampoPorCodigo("SELECT_MULTIPLE");

  const tipoTramiteLegajo = await ensureTipoTramite({
    codigo: "TEST_LEGAJO_1",
    nombre: "Prueba legajo 1",
    idCategoria: categoriaSobreLegajos.id,
    idEstrategia: estrategiaTramites.id,
    idEntidad: entidadLegajos.id,
  });
  const campoAsunto = await ensureTipoTramiteCampo({
    codigo: "asunto",
    nombre: "Asunto",
    idTipoTramite: tipoTramiteLegajo.id,
    idTipoCampo: tipoCampoTexto.id,
    orden: 1,
    obligatorio: true,
    placeholder: "Asunto del trámite",
  });
  await ensureTipoTramiteCampo({
    codigo: "fecha_limite",
    nombre: "Fecha límite",
    idTipoTramite: tipoTramiteLegajo.id,
    idTipoCampo: tipoCampoFecha.id,
    orden: 2,
  });
  const campoPrioridad = await ensureTipoTramiteCampo({
    codigo: "prioridad",
    nombre: "Prioridad",
    idTipoTramite: tipoTramiteLegajo.id,
    idTipoCampo: tipoCampoSelect.id,
    orden: 3,
    listaValores: `SELECT * FROM (VALUES ('alta','Alta'), ('media','Media'), ('baja','Baja')) AS v(value, label)`,
  });
  const campoUrgente = await ensureTipoTramiteCampo({
    codigo: "urgente",
    nombre: "Urgente",
    idTipoTramite: tipoTramiteLegajo.id,
    idTipoCampo: tipoCampoCheckbox.id,
    orden: 4,
  });

  const tipoTramiteCliente = await ensureTipoTramite({
    codigo: "TEST_CLI_1",
    nombre: "Prueba clientes",
    idCategoria: categoriaSobreClientes.id,
    idEstrategia: estrategiaTramites.id,
    idEntidad: entidadClientes.id,
  });
  const campoMotivo = await ensureTipoTramiteCampo({
    codigo: "motivo",
    nombre: "Motivo",
    idTipoTramite: tipoTramiteCliente.id,
    idTipoCampo: tipoCampoTexto.id,
    orden: 1,
    obligatorio: true,
  });
  const campoTelefonoContacto = await ensureTipoTramiteCampo({
    codigo: "telefono_contacto",
    nombre: "Teléfono de contacto",
    idTipoTramite: tipoTramiteCliente.id,
    idTipoCampo: tipoCampoTel.id,
    orden: 2,
  });
  const campoMonto = await ensureTipoTramiteCampo({
    codigo: "monto",
    nombre: "Monto",
    idTipoTramite: tipoTramiteCliente.id,
    idTipoCampo: tipoCampoNumero.id,
    orden: 3,
    numMin: 0,
  });

  const tipoTramiteClienteTitular = await ensureTipoTramite({
    codigo: "TEST_CLI_TIT_1",
    nombre: "Prueba clientes titulares",
    idCategoria: categoriaSobreClientes.id,
    idEstrategia: estrategiaTramites.id,
    idEntidad: entidadClientes.id,
    filtro: "fn_filtro_tramite_cli_titular_1",
  });
  const campoEmailContacto = await ensureTipoTramiteCampo({
    codigo: "email_contacto",
    nombre: "Email de contacto",
    idTipoTramite: tipoTramiteClienteTitular.id,
    idTipoCampo: tipoCampoEmail.id,
    orden: 1,
    obligatorio: true,
  });
  const campoCanalPreferido = await ensureTipoTramiteCampo({
    codigo: "canal_preferido",
    nombre: "Canal preferido",
    idTipoTramite: tipoTramiteClienteTitular.id,
    idTipoCampo: tipoCampoSelectMultiple.id,
    orden: 2,
    listaValores: `SELECT * FROM (VALUES ('email','Email'), ('telefono','Teléfono'), ('whatsapp','WhatsApp')) AS v(value, label)`,
  });
  const campoAceptaTerminos = await ensureTipoTramiteCampo({
    codigo: "acepta_terminos",
    nombre: "Acepta términos",
    idTipoTramite: tipoTramiteClienteTitular.id,
    idTipoCampo: tipoCampoCheckbox.id,
    orden: 3,
    obligatorio: true,
  });

  // --- Instancias de trámite de prueba, sobre algunos de los legajos demo ---
  const estimuloActualizarTramite = await getEstimuloPorCodigo(estrategiaTramites.id, "actualizar");
  const estimuloResolverTramite = await getEstimuloPorCodigo(estrategiaTramites.id, "resolver");

  const legajo1 = await getLegajoPorNumero("DEMO-0001");
  await ensureTramiteDemo({
    idTipoTramite: tipoTramiteLegajo.id,
    idRegistro: legajo1.id,
    datos: [
      mapearValorCampo("INPUT_TEXT", campoAsunto.id, "Consulta general"),
      mapearValorCampo("SELECT", campoPrioridad.id, "media"),
      mapearValorCampo("INPUT_CHECKBOX", campoUrgente.id, false),
    ],
    idEstimulo: estimuloActualizarTramite.id,
    idUsuario: admin.id,
    observacion: "Trámite demo — consulta general del legajo.",
  });

  const legajo2 = await getLegajoPorNumero("DEMO-0002");
  await ensureTramiteDemo({
    idTipoTramite: tipoTramiteLegajo.id,
    idRegistro: legajo2.id,
    datos: [
      mapearValorCampo("INPUT_TEXT", campoAsunto.id, "Reclamo por facturación"),
      mapearValorCampo("SELECT", campoPrioridad.id, "alta"),
      mapearValorCampo("INPUT_CHECKBOX", campoUrgente.id, true),
    ],
    idEstimulo: estimuloResolverTramite.id,
    idUsuario: admin.id,
    observacion: "Trámite demo — reclamo ya resuelto.",
  });

  const legajo3 = await getLegajoPorNumero("DEMO-0003");
  const titular3 = await getTitularDelLegajo(legajo3.id);
  await ensureTramiteDemo({
    idTipoTramite: tipoTramiteCliente.id,
    idRegistro: titular3.id,
    datos: [
      mapearValorCampo("INPUT_TEXT", campoMotivo.id, "Actualización de datos de contacto"),
      mapearValorCampo("INPUT_TEL", campoTelefonoContacto.id, "+54 11 5555-1234"),
      mapearValorCampo("INPUT_NUMBER", campoMonto.id, 1500),
    ],
    idEstimulo: estimuloActualizarTramite.id,
    idUsuario: admin.id,
    observacion: "Trámite demo — sobre el cliente titular.",
  });

  const legajo4 = await getLegajoPorNumero("DEMO-0004");
  const titular4 = await getTitularDelLegajo(legajo4.id);
  await ensureTramiteDemo({
    idTipoTramite: tipoTramiteClienteTitular.id,
    idRegistro: titular4.id,
    datos: [
      mapearValorCampo("INPUT_EMAIL", campoEmailContacto.id, "camila.lopez@example.com"),
      mapearValorCampo("SELECT_MULTIPLE", campoCanalPreferido.id, ["email", "whatsapp"]),
      mapearValorCampo("INPUT_CHECKBOX", campoAceptaTerminos.id, true),
    ],
    idEstimulo: estimuloResolverTramite.id,
    idUsuario: admin.id,
    observacion: "Trámite demo — sobre cliente titular, vía el tipo con filtro.",
  });

  console.log("Seed de prueba aplicado (idempotente): 10 legajos, 20 clientes, 3 tipos de trámite, 4 trámites de ejemplo.");
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed de prueba:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
