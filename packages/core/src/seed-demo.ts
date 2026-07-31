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
  transiciones,
  acciones,
  transicionesAcciones,
  placeholders,
  plantillasAdjunto,
  legajos,
  clientes,
  tramites,
  entidades,
  categoriasTiposTramite,
  tiposTramite,
  tiposCampos,
  tiposTramiteCampos,
  interfaz,
  perfiles,
  herramientas,
  operaciones,
  permisos,
} from "@valgian/db";
import { gestionarTramite, mapearValorCampo, type DatoTramiteInput } from "./tramites";
import { crearPlantillaAdjunto } from "./plantillas-adjunto";
import { OPERACION_ADJUNTOS_BORRAR } from "./archivos-adjuntos";

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

async function getInterfazPorCodigo(codigo: string) {
  const [fila] = await db.select().from(interfaz).where(eq(interfaz.codigo, codigo));
  if (!fila) throw new Error(`No existe INTERFAZ.CODIGO = "${codigo}" — corré el seed principal primero.`);
  return fila;
}

async function ensurePerfilPorCodigo(codigo: string, nombre: string, idInterfaz: string) {
  const [existente] = await db.select().from(perfiles).where(eq(perfiles.codigo, codigo));
  if (existente) return existente;

  const [creado] = await db.insert(perfiles).values({ codigo, nombre, idInterfaz }).returning();
  return creado;
}

async function ensurePermisoOperacionDemo(idPerfil: string, idOperacion: string) {
  const [existente] = await db
    .select()
    .from(permisos)
    .where(and(eq(permisos.idPerfil, idPerfil), eq(permisos.idOperacion, idOperacion)));
  if (existente) return existente;

  const [creado] = await db.insert(permisos).values({ idPerfil, idOperacion }).returning();
  return creado;
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

async function getTransicion(idEstrategia: string, idEstado0: string, idEstimulo: string) {
  const [transicion] = await db
    .select()
    .from(transiciones)
    .where(and(eq(transiciones.idEstrategia, idEstrategia), eq(transiciones.idEstado0, idEstado0), eq(transiciones.idEstimulo, idEstimulo)));
  if (!transicion) throw new Error(`No existe la transición (estrategia=${idEstrategia}, estado0=${idEstado0}, estimulo=${idEstimulo}).`);
  return transicion;
}

async function ensureAccion(params: { idEstrategia: string; codigo: string; nombre: string; comando: string }) {
  const [existente] = await db
    .select()
    .from(acciones)
    .where(and(eq(acciones.idEstrategia, params.idEstrategia), eq(acciones.codigo, params.codigo)));
  if (existente) return existente;

  const [creada] = await db.insert(acciones).values(params).returning();
  return creada;
}

async function ensureTransicionAccion(idTransicion: string, idAccion: string, orden: number) {
  const [existente] = await db
    .select()
    .from(transicionesAcciones)
    .where(and(eq(transicionesAcciones.idTransicion, idTransicion), eq(transicionesAcciones.idAccion, idAccion)));
  if (existente) return existente;

  const [creada] = await db.insert(transicionesAcciones).values({ idTransicion, idAccion, orden }).returning();
  return creada;
}

async function ensurePlaceholderDemo(params: { codigo: string; nombre: string; query: string; escapar: boolean }) {
  const [existente] = await db.select().from(placeholders).where(eq(placeholders.codigo, params.codigo));
  if (existente) return existente;

  const [creado] = await db.insert(placeholders).values(params).returning();
  return creado;
}

async function ensurePlantillaDemo(params: { codigo: string; nombre: string; descripcion?: string; html: string; idUsuario: string }) {
  const [existente] = await db.select().from(plantillasAdjunto).where(eq(plantillasAdjunto.codigo, params.codigo));
  if (existente) return existente;

  const resultado = await crearPlantillaAdjunto({
    codigo: params.codigo,
    nombre: params.nombre,
    descripcion: params.descripcion ?? null,
    buffer: Buffer.from(params.html, "utf-8"),
    nombreOriginal: `${params.codigo}.html`,
    mimetype: "text/html",
    idUsuario: params.idUsuario,
  });
  if (resultado.error || !resultado.data) throw new Error(`Error creando la plantilla demo "${params.codigo}": ${resultado.error}`);

  const [fila] = await db.select().from(plantillasAdjunto).where(eq(plantillasAdjunto.id, resultado.data.id));
  return fila;
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

  // --- Generación de documentos: placeholders + plantilla + acción demo ---
  // Al resolver un trámite (estrategia STD_TRAMITE_1), se genera un PDF de
  // comprobante a partir de la plantilla "demo_comprobante_1" — ver
  // domain/generacion-documentos.md.
  const phFecha = await ensurePlaceholderDemo({
    codigo: "demo_fecha_generacion",
    nombre: "Fecha de generación (demo)",
    query: `SELECT to_char(($1::jsonb->>'fecha')::timestamptz, 'DD/MM/YYYY HH24:MI') AS valor`,
    escapar: true,
  });
  const phAsunto = await ensurePlaceholderDemo({
    codigo: "demo_asunto_tramite",
    nombre: "Asunto del trámite (demo)",
    query: `
      SELECT tcd."VALOR_TEXTO" AS valor
      FROM "TRAMITES_CAMPOS_DATOS" tcd
      JOIN "TIPOS_TRAMITE_CAMPOS" ttc ON ttc."ID" = tcd."ID_TIPO_TRAMITE_CAMPO"
      WHERE tcd."ID_TRAMITE" = ($1::jsonb->>'id_tramite')::uuid AND ttc."CODIGO" = 'asunto'
    `,
    escapar: true,
  });
  const phNumeroLegajo = await ensurePlaceholderDemo({
    codigo: "demo_numero_legajo",
    nombre: "Número de legajo (demo)",
    query: `
      SELECT l."NUMERO" AS valor
      FROM "TRAMITES" t
      JOIN "LEGAJOS" l ON l."ID" = t."ID_REGISTRO"
      WHERE t."ID" = ($1::jsonb->>'id_tramite')::uuid
    `,
    escapar: true,
  });
  const phPrioridadHtml = await ensurePlaceholderDemo({
    codigo: "demo_prioridad_html",
    nombre: "Badge de prioridad, HTML (demo)",
    query: `
      SELECT CASE tcd."VALOR_TEXTO"
        WHEN 'alta' THEN '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;">Alta</span>'
        WHEN 'media' THEN '<span style="background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:4px;">Media</span>'
        WHEN 'baja' THEN '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;">Baja</span>'
        ELSE '<span>Sin definir</span>'
      END AS valor
      FROM "TRAMITES_CAMPOS_DATOS" tcd
      JOIN "TIPOS_TRAMITE_CAMPOS" ttc ON ttc."ID" = tcd."ID_TIPO_TRAMITE_CAMPO"
      WHERE tcd."ID_TRAMITE" = ($1::jsonb->>'id_tramite')::uuid AND ttc."CODIGO" = 'prioridad'
    `,
    escapar: false,
  });

  await ensurePlantillaDemo({
    codigo: "demo_comprobante_1",
    nombre: "Comprobante de gestión (demo)",
    descripcion: "Plantilla de prueba — se dispara al resolver un trámite sobre legajo.",
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:24px;color:#1e293b;} h1{font-size:20px;}</style></head>
<body>
  <h1>Comprobante de gestión</h1>
  <p><strong>Fecha:</strong> ##${phFecha.codigo}##</p>
  <p><strong>Legajo:</strong> ##${phNumeroLegajo.codigo}##</p>
  <p><strong>Asunto:</strong> ##${phAsunto.codigo}##</p>
  <p><strong>Prioridad:</strong> ##${phPrioridadHtml.codigo}##</p>
</body>
</html>`,
    idUsuario: admin.id,
  });

  const estadoInicialTramites = await getEstadoInicial(estrategiaTramites.id);
  const transicionResolver = await getTransicion(estrategiaTramites.id, estadoInicialTramites.id, estimuloResolverTramite.id);
  const accionGenerarComprobante = await ensureAccion({
    idEstrategia: estrategiaTramites.id,
    codigo: "generar_comprobante_1",
    nombre: "Generar comprobante de gestión (demo)",
    // El documento se asocia a lo que el TRÁMITE ES SOBRE (legajo, cliente...),
    // no al trámite en sí — nunca hay pantalla que muestre "adjuntos de un
    // trámite", pero sí la solapa Adjuntos del legajo/cliente correspondiente.
    // Por eso ID_ENTIDAD/ID_REGISTRO salen de TIPOS_TRAMITE.ID_ENTIDAD y
    // TRAMITES.ID_REGISTRO, no de la entidad "tramites" ni del propio $1.
    comando: `
      INSERT INTO "GENERACIONES_DOCUMENTO" ("ID_PLANTILLA", "ID_ENTIDAD", "ID_REGISTRO", "DATOS", "ESTADO", "ALTA_FECHA")
      SELECT
        (SELECT "ID" FROM "PLANTILLAS_ADJUNTOS" WHERE "CODIGO" = 'demo_comprobante_1'),
        tt."ID_ENTIDAD",
        t."ID_REGISTRO",
        jsonb_build_object('id_tramite', $1::text, 'fecha', now()::text),
        'pendiente',
        now()
      FROM "TRAMITES" t
      JOIN "TIPOS_TRAMITE" tt ON tt."ID" = t."ID_TIPO_TRAMITE"
      WHERE t."ID" = $1
    `,
  });
  await ensureTransicionAccion(transicionResolver.id, accionGenerarComprobante.id, 1);

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

  // Perfil de prueba "Admin2": todos los permisos salvo Borrar en Archivos
  // Adjuntos — sirve para verificar en vivo que el gate granular de un botón
  // puntual efectivamente bloquea, sin tener que restringir todo el perfil.
  const interfazDefault = await getInterfazPorCodigo("default");
  const perfilAdmin2 = await ensurePerfilPorCodigo("Admin2", "Administrador test 2", interfazDefault.id);

  const todasLasOperaciones = await db
    .select({ id: operaciones.id, codigo: operaciones.codigo, herramientaCodigo: herramientas.codigo })
    .from(operaciones)
    .innerJoin(herramientas, eq(herramientas.id, operaciones.idHerramienta));

  for (const operacion of todasLasOperaciones) {
    const esBorrarAdjuntos = operacion.herramientaCodigo === "LEGAJO_ADJ_1" && operacion.codigo === OPERACION_ADJUNTOS_BORRAR;
    if (esBorrarAdjuntos) continue;
    await ensurePermisoOperacionDemo(perfilAdmin2.id, operacion.id);
  }

  console.log(
    "Seed de prueba aplicado (idempotente): 10 legajos, 20 clientes, 3 tipos de trámite, 4 trámites de ejemplo, 4 placeholders + 1 plantilla + 1 acción de generación de documentos, perfil Admin2 con todos los permisos salvo Borrar adjuntos.",
  );
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed de prueba:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
