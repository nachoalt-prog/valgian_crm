import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Naming: los nombres de tabla/columna siguen MAYÚSCULAS_CON_GUION_BAJO
 * tal cual domain/infraestructura.md y domain/core.md — implica identificadores
 * quoteados en el SQL generado. Nullability: todo nullable salvo PK, CODIGO,
 * NOMBRE (regla temporal acordada, domain/core.md "Convenciones generales"),
 * más USERNAME/PASSWORD_HASH en USUARIOS (login no funciona sin esto) y
 * NUMERO en LEGAJOS/CUENTAS (identificador de negocio, mismo criterio).
 */

export const interfaz = pgTable("INTERFAZ", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  fuente: text("FUENTE"),
  colorPrimario: text("COLOR_PRIMARIO"),
  colorSecundario: text("COLOR_SECUNDARIO"),
  titulo: text("TITULO"),
  imagenFondo: text("IMAGEN_FONDO"),
});

export const perfiles = pgTable("PERFILES", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  idInterfaz: uuid("ID_INTERFAZ").references(() => interfaz.id),
  comodin: jsonb("COMODIN"),
});

export const usuarios = pgTable(
  "USUARIOS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idPerfil: uuid("ID_PERFIL").references(() => perfiles.id),
    username: text("USERNAME").notNull(),
    passwordHash: text("PASSWORD_HASH").notNull(),
    token: text("TOKEN"),
    tokenExpiracion: timestamp("TOKEN_EXPIRACION", { withTimezone: true }),
    // Reemplaza a AVATAR_PATH (ver ADR 0011, addendum) — la foto de
    // perfil ahora es un ARCHIVOS_ADJUNTOS más, vía la entidad polimórfica
    // 'usuarios'. Referencia forward (ARCHIVOS_ADJUNTOS se declara más abajo
    // y a su vez referencia USUARIOS para su propia auditoría) — de ahí el
    // cast a AnyPgColumn, mismo truco que TRAMITES.ID_TRAMITE_PADRE.
    idArchivoAdjunto: uuid("ID_ARCHIVO_ADJUNTO").references((): AnyPgColumn => archivosAdjuntos.id),
    comodin: jsonb("COMODIN"),
  },
  (table) => [uniqueIndex("USUARIOS_USERNAME_UNIQUE").on(table.username)],
);

export const herramientas = pgTable("HERRAMIENTAS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  slug: text("SLUG"),
  comodin: jsonb("COMODIN"),
  // Ayuda para el editor de PARAMETROS en los ABMs de Layouts de Legajo y
  // Menúes (ver domain/infraestructura.md, "Parámetros por punto de acceso").
  // EJEMPLO puede ser un objeto real (ej. {"crear": true, ...}) o directamente
  // un string JSON con un mensaje ("de momento no soporta parámetros") — ambos
  // son jsonb válidos, por eso sin `.$type<>()` fijo acá.
  parametrosEjemplo: jsonb("PARAMETROS_EJEMPLO"),
  parametrosGuia: text("PARAMETROS_GUIA"),
});

/**
 * Acciones concretas dentro de una herramienta (ver domain/infraestructura.md).
 * Toda herramienta tiene como mínimo la operación CODIGO='acceso' — el permiso
 * sobre esa operación es lo que hoy decide si la herramienta se ve o no. Una
 * herramienta puede sumar operaciones más finas (ej. ARCHIVOS_ADJUNTOS: crear,
 * reemplazar, descargar, guardar, borrar) para gatillar botones puntuales.
 */
export const operaciones = pgTable(
  "OPERACIONES",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idHerramienta: uuid("ID_HERRAMIENTA").references(() => herramientas.id),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
  },
  (table) => [uniqueIndex("OPERACIONES_HERRAMIENTA_CODIGO_UNIQUE").on(table.idHerramienta, table.codigo)],
);

export const permisos = pgTable(
  "PERMISOS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idPerfil: uuid("ID_PERFIL").references(() => perfiles.id),
    idOperacion: uuid("ID_OPERACION").references(() => operaciones.id),
  },
  (table) => [uniqueIndex("PERMISOS_PERFIL_OPERACION_UNIQUE").on(table.idPerfil, table.idOperacion)],
);

export const menues = pgTable("MENUES", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  comodin: jsonb("COMODIN"),
});

export const menuesOpciones = pgTable("MENUES_OPCIONES", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idMenu: uuid("ID_MENU").references(() => menues.id),
  idHerramienta: uuid("ID_HERRAMIENTA").references(() => herramientas.id),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  icono: text("ICONO"),
  orden: integer("ORDEN"),
  comodin: jsonb("COMODIN"),
  // Mismo mecanismo que LAYOUTS_LEGAJO_SOLAPAS.PARAMETROS — todavía sin
  // ningún consumidor real (ninguna herramienta con entrada de menú lo
  // interpreta hoy), preparado para cuando haga falta.
  parametros: jsonb("PARAMETROS").$type<Record<string, unknown>>(),
});

export const interfacesMenues = pgTable(
  "INTERFACES_MENUES",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idInterfaz: uuid("ID_INTERFAZ").references(() => interfaz.id),
    idMenu: uuid("ID_MENU").references(() => menues.id),
  },
  (table) => [uniqueIndex("INTERFACES_MENUES_INTERFAZ_MENU_UNIQUE").on(table.idInterfaz, table.idMenu)],
);

export const productos = pgTable("PRODUCTOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  modulo: text("MODULO"),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  comodin: jsonb("COMODIN"),
});

export const subProductos = pgTable("SUB_PRODUCTOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idProducto: uuid("ID_PRODUCTO").references(() => productos.id),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  comodin: jsonb("COMODIN"),
});

export const paises = pgTable("PAISES", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
});

export const provincias = pgTable("PROVINCIAS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idPais: uuid("ID_PAIS").references(() => paises.id),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
});

export const caracteres = pgTable("CARACTERES", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
});

export const tiposDocumento = pgTable("TIPOS_DOCUMENTO", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
});

export const generos = pgTable("GENEROS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
});

export const entidades = pgTable("ENTIDADES", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
});

/**
 * Motor de estados: mecanismo genérico y configurable para gobernar el ciclo
 * de vida de cualquier entidad con estado (ver domain/motor-de-estados.md).
 */

export const estrategias = pgTable("ESTRATEGIAS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  idEntidad: uuid("ID_ENTIDAD").references(() => entidades.id),
});

export const estados = pgTable(
  "ESTADOS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idEstrategia: uuid("ID_ESTRATEGIA").references(() => estrategias.id),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
    esInicial: boolean("ES_INICIAL"),
    esFinal: boolean("ES_FINAL"),
    comodin: jsonb("COMODIN"),
  },
  (table) => [
    // Máximo un ES_INICIAL = true por estrategia. ES_FINAL no lleva esta
    // restricción — una estrategia puede tener varios desenlaces terminales.
    uniqueIndex("ESTADOS_ESTRATEGIA_INICIAL_UNIQUE")
      .on(table.idEstrategia)
      .where(sql`${table.esInicial} = true`),
  ],
);

export const estimulos = pgTable("ESTIMULOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idEstrategia: uuid("ID_ESTRATEGIA").references(() => estrategias.id),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  comodin: jsonb("COMODIN"),
});

// Qué perfiles pueden aplicar qué estímulos — gobierna el selector de
// SP_APLICAR_ESTIMULO en la herramienta "Gestión de Entidad".
export const perfilesEstimulos = pgTable(
  "PERFILES_ESTIMULOS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idPerfil: uuid("ID_PERFIL").references(() => perfiles.id),
    idEstimulo: uuid("ID_ESTIMULO").references(() => estimulos.id),
  },
  (table) => [uniqueIndex("PERFILES_ESTIMULOS_PERFIL_ESTIMULO_UNIQUE").on(table.idPerfil, table.idEstimulo)],
);

export const acciones = pgTable("ACCIONES", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idEstrategia: uuid("ID_ESTRATEGIA").references(() => estrategias.id),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  comando: text("COMANDO"),
  comodin: jsonb("COMODIN"),
});

export const transiciones = pgTable(
  "TRANSICIONES",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idEstrategia: uuid("ID_ESTRATEGIA").references(() => estrategias.id),
    idEstado0: uuid("ID_ESTADO_0").references(() => estados.id),
    idEstimulo: uuid("ID_ESTIMULO").references(() => estimulos.id),
    idEstado1: uuid("ID_ESTADO_1").references(() => estados.id),
  },
  (table) => [
    // Para una combinación (estrategia, estado origen, estímulo) existe como
    // máximo una transición válida.
    uniqueIndex("TRANSICIONES_ESTRATEGIA_ESTADO0_ESTIMULO_UNIQUE").on(
      table.idEstrategia,
      table.idEstado0,
      table.idEstimulo,
    ),
  ],
);

export const transicionesAcciones = pgTable("TRANSICIONES_ACCIONES", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idTransicion: uuid("ID_TRANSICION").references(() => transiciones.id),
  idAccion: uuid("ID_ACCION").references(() => acciones.id),
  orden: integer("ORDEN"),
});

export const historial = pgTable("HISTORIAL", {
  id: uuid("ID").primaryKey().defaultRandom(),
  // Se graba el estado_0/estimulo/estado_1 tal cual ocurrieron, no la FK a
  // TRANSICIONES — así queda registrado el camino real sin impedir que la
  // transición usada se modifique o borre a futuro (ver domain/motor-de-estados.md).
  idEstado0: uuid("ID_ESTADO_0").references(() => estados.id),
  idEstimulo: uuid("ID_ESTIMULO").references(() => estimulos.id),
  idEstado1: uuid("ID_ESTADO_1").references(() => estados.id),
  idEntidad: uuid("ID_ENTIDAD").references(() => entidades.id),
  idRelacion: uuid("ID_RELACION"),
  observacion: text("OBSERVACION"),
  accionesStatus: integer("ACCIONES_STATUS"),
  accionesError: text("ACCIONES_ERROR"),
  auditFecha: timestamp("AUDIT_FECHA", { withTimezone: true }),
  auditUsuario: uuid("AUDIT_USUARIO").references(() => usuarios.id),
});

export const legajos = pgTable("LEGAJOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  numero: text("NUMERO").notNull(),
  idEstado: uuid("ID_ESTADO").references(() => estados.id),
  altaFecha: timestamp("ALTA_FECHA", { withTimezone: true }),
  altaUsuario: uuid("ALTA_USUARIO").references(() => usuarios.id),
  auditFecha: timestamp("AUDIT_FECHA", { withTimezone: true }),
  auditUsuario: uuid("AUDIT_USUARIO").references(() => usuarios.id),
  comodin: jsonb("COMODIN"),
});

export const clientes = pgTable("CLIENTES", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idLegajo: uuid("ID_LEGAJO").references(() => legajos.id),
  idCaracter: uuid("ID_CARACTER").references(() => caracteres.id),
  esTitular: boolean("ES_TITULAR"),
  idTipoDocumento: uuid("ID_TIPO_DOCUMENTO").references(() => tiposDocumento.id),
  nroDocumento: text("NRO_DOCUMENTO"),
  apellido: text("APELLIDO"),
  nombre: text("NOMBRE").notNull(),
  idGenero: uuid("ID_GENERO").references(() => generos.id),
  idProvincia: uuid("ID_PROVINCIA").references(() => provincias.id),
  altaFecha: timestamp("ALTA_FECHA", { withTimezone: true }),
  altaUsuario: uuid("ALTA_USUARIO").references(() => usuarios.id),
  auditFecha: timestamp("AUDIT_FECHA", { withTimezone: true }),
  auditUsuario: uuid("AUDIT_USUARIO").references(() => usuarios.id),
});

/**
 * Emails de un cliente — 0..N por CLIENTES, a lo sumo uno marcado PRINCIPAL
 * (mismo criterio de "único activo, auto-swap" que CLIENTES.ES_TITULAR sobre
 * ID_LEGAJO — ver 0001_trigger_clientes_titular.sql / trigger análogo acá).
 * ABM propio, embebido en el modal de Legajo dentro de Clientes (core, no
 * depende de ningún módulo de mensajería).
 */
export const emails = pgTable("EMAILS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  email: text("EMAIL").notNull(),
  principal: boolean("PRINCIPAL"),
  idCliente: uuid("ID_CLIENTE").references(() => clientes.id),
  comodin: jsonb("COMODIN"),
  altaFecha: timestamp("ALTA_FECHA", { withTimezone: true }),
  altaUsuario: uuid("ALTA_USUARIO").references(() => usuarios.id),
  auditFecha: timestamp("AUDIT_FECHA", { withTimezone: true }),
  auditUsuario: uuid("AUDIT_USUARIO").references(() => usuarios.id),
});

export const cuentas = pgTable("CUENTAS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idLegajo: uuid("ID_LEGAJO").references(() => legajos.id),
  numero: text("NUMERO").notNull(),
  idProducto: uuid("ID_PRODUCTO").references(() => productos.id),
  idEstado: uuid("ID_ESTADO").references(() => estados.id),
  altaFecha: timestamp("ALTA_FECHA", { withTimezone: true }),
  altaUsuario: uuid("ALTA_USUARIO").references(() => usuarios.id),
  auditFecha: timestamp("AUDIT_FECHA", { withTimezone: true }),
  auditUsuario: uuid("AUDIT_USUARIO").references(() => usuarios.id),
  comodin: jsonb("COMODIN"),
});

/**
 * Bandejas: buscador configurable (filtros y columnas dinámicos según la
 * bandeja elegida) sobre legajos, clientes o trámites — ver domain/bandejas.md.
 */

export const filtros = pgTable("FILTROS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  // 'texto_like' | 'select' | 'fecha' | 'fecha_rango'
  tipo: text("TIPO"),
  // Solo para TIPO='select': SQL que devuelve las opciones del desplegable (columnas value/label).
  query: text("QUERY"),
});

export const bandejas = pgTable("BANDEJAS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  // SELECT con alias — la base sobre la que se filtra y de la que salen las columnas.
  query: text("QUERY"),
  // Qué alias de QUERY se muestran como columnas del listado, en qué orden y con qué label.
  columnas: jsonb("COLUMNAS"),
  // Qué LAYOUTS_LEGAJO se despliega al abrir un resultado de esta bandeja — una
  // bandeja usa un único layout, por eso es una columna acá y no una tabla de
  // relación (ver domain/layouts-legajo.md).
  idLayout: uuid("ID_LAYOUT").references(() => layoutsLegajo.id),
  // 'legajo' (default, abre LegajoLayoutModal con ID_LAYOUT) | 'tramite' (abre
  // el modal de trámites directo, ignora ID_LAYOUT) — qué componente monta el
  // botón "Abrir" (ver domain/tramites.md).
  tipoApertura: text("TIPO_APERTURA"),
});

export const bandejasFiltros = pgTable("BANDEJAS_FILTROS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idBandeja: uuid("ID_BANDEJA").references(() => bandejas.id),
  idFiltro: uuid("ID_FILTRO").references(() => filtros.id),
  // Alias de BANDEJAS.QUERY al que aplica este filtro en esta bandeja puntual.
  campo: text("CAMPO"),
  orden: integer("ORDEN"),
});

export const bandejasPerfiles = pgTable(
  "BANDEJAS_PERFILES",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idBandeja: uuid("ID_BANDEJA").references(() => bandejas.id),
    idPerfil: uuid("ID_PERFIL").references(() => perfiles.id),
  },
  (table) => [uniqueIndex("BANDEJAS_PERFILES_BANDEJA_PERFIL_UNIQUE").on(table.idBandeja, table.idPerfil)],
);

/**
 * Reportes: mismo mecanismo de query-filtros que Bandejas (ver ADR 0014,
 * domain/reportes.md) pero sin acción de apertura — un reporte se mira y se
 * exporta, no dispara nada sobre un legajo/trámite. Tabla separada de
 * BANDEJAS a propósito (conceptos de producto distintos).
 */
export const reportes = pgTable(
  "REPORTES",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
    descripcion: text("DESCRIPCION"),
    // SELECT con alias — la base sobre la que se filtra y de la que salen las columnas.
    query: text("QUERY"),
    // Qué alias de QUERY se muestran como columnas del listado, en qué orden y con qué label.
    columnas: jsonb("COLUMNAS"),
  },
  (table) => [uniqueIndex("REPORTES_CODIGO_UNIQUE").on(table.codigo)],
);

export const reportesFiltros = pgTable("REPORTES_FILTROS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idReporte: uuid("ID_REPORTE").references(() => reportes.id),
  idFiltro: uuid("ID_FILTRO").references(() => filtros.id),
  // Alias de REPORTES.QUERY al que aplica este filtro en este reporte puntual.
  campo: text("CAMPO"),
  orden: integer("ORDEN"),
});

export const reportesPerfiles = pgTable(
  "REPORTES_PERFILES",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idReporte: uuid("ID_REPORTE").references(() => reportes.id),
    idPerfil: uuid("ID_PERFIL").references(() => perfiles.id),
  },
  (table) => [uniqueIndex("REPORTES_PERFILES_REPORTE_PERFIL_UNIQUE").on(table.idReporte, table.idPerfil)],
);

/**
 * Layouts de legajo: qué solapas (hasta 10) se muestran al abrir un legajo
 * desde una bandeja, y qué herramienta se carga dentro de cada una — ver
 * domain/layouts-legajo.md.
 */

export const layoutsLegajo = pgTable("LAYOUTS_LEGAJO", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
});

export const layoutsLegajoSolapas = pgTable(
  "LAYOUTS_LEGAJO_SOLAPAS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idLayout: uuid("ID_LAYOUT").references(() => layoutsLegajo.id),
    orden: integer("ORDEN"),
    nombre: text("NOMBRE").notNull(),
    idHerramienta: uuid("ID_HERRAMIENTA").references(() => herramientas.id),
    visible: boolean("VISIBLE"),
    // Config específica de ESTA instancia de la herramienta embebida — ej. para
    // LEGAJO_ADJ_1, {"crear": false} desactiva el botón Nuevo solo en este layout,
    // sin tocar el permiso del perfil. Nullable/ausente = sin restricción
    // adicional (ver domain/infraestructura.md, "Parámetros por punto de acceso").
    parametros: jsonb("PARAMETROS").$type<Record<string, unknown>>(),
  },
  (table) => [uniqueIndex("LAYOUTS_LEGAJO_SOLAPAS_LAYOUT_ORDEN_UNIQUE").on(table.idLayout, table.orden)],
);

/**
 * Trámites: formularios configurables (por tipo de trámite) que se pueden
 * iniciar y gestionar sobre cualquier registro (legajo, cliente, cuenta) —
 * reutiliza el motor de estados (ESTRATEGIAS/ESTADOS/ESTIMULOS/TRANSICIONES)
 * para su propio ciclo de vida. Ver domain/tramites.md.
 */

export const categoriasTiposTramite = pgTable("CATEGORIAS_TIPOS_TRAMITE", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
});

export const tiposTramite = pgTable("TIPOS_TRAMITE", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  comodin: jsonb("COMODIN"),
  idCategoria: uuid("ID_CATEGORIA").references(() => categoriasTiposTramite.id),
  idEstrategia: uuid("ID_ESTRATEGIA").references(() => estrategias.id),
  // A qué entidad se asocian los trámites de este tipo (legajos/clientes/cuentas).
  idEntidad: uuid("ID_ENTIDAD").references(() => entidades.id),
  // Nombre de una función SQL fn(uuid[]) RETURNS uuid[] — filtra (y puede
  // reordenar) los candidatos de "Aplicar a" en el ABM. Null = sin filtro.
  filtro: text("FILTRO"),
  // Código de componente React a usar en vez del dibujado automático de
  // TIPOS_TRAMITE_CAMPOS (mismo patrón que HERRAMIENTAS). Null = 'default'.
  componente: text("COMPONENTE"),
});

export const tiposCampos = pgTable("TIPOS_CAMPOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
});

export const tiposTramiteCampos = pgTable("TIPOS_TRAMITE_CAMPOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  codigo: text("CODIGO").notNull(),
  nombre: text("NOMBRE").notNull(),
  idTipoTramite: uuid("ID_TIPO_TRAMITE").references(() => tiposTramite.id),
  idTipoCampo: uuid("ID_TIPO_CAMPO").references(() => tiposCampos.id),
  orden: integer("ORDEN"),
  obligatorio: boolean("OBLIGATORIO"),
  visible: boolean("VISIBLE"),
  editable: boolean("EDITABLE"),
  longitudMax: integer("LONGITUD_MAX"),
  numMin: integer("NUM_MIN"),
  numMax: integer("NUM_MAX"),
  numStep: integer("NUM_STEP"),
  // Agrupa radio buttons — dentro de un mismo TIPOS_TRAMITE_CAMPOS.ID_TIPO_TRAMITE,
  // los campos con el mismo RADIO_GROUP se comportan como un único grupo excluyente.
  radioGroup: integer("RADIO_GROUP"),
  placeholder: text("PLACEHOLDER"),
  ayuda: text("AYUDA"),
  mascara: text("MASCARA"),
  regex: text("REGEX"),
  // SQL de confianza (ADR 0009) que devuelve las opciones de SELECT/SELECT_MULTIPLE.
  listaValores: text("LISTA_VALORES"),
});

export const tramites = pgTable("TRAMITES", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idTipoTramite: uuid("ID_TIPO_TRAMITE").references(() => tiposTramite.id),
  idEstado: uuid("ID_ESTADO").references(() => estados.id),
  // Junto a TIPOS_TRAMITE.ID_ENTIDAD (vía idTipoTramite) ubica el registro real.
  idRegistro: uuid("ID_REGISTRO"),
  comodin: jsonb("COMODIN"),
  altaFecha: timestamp("ALTA_FECHA", { withTimezone: true }),
  altaUsuario: uuid("ALTA_USUARIO").references(() => usuarios.id),
  auditFecha: timestamp("AUDIT_FECHA", { withTimezone: true }),
  auditUsuario: uuid("AUDIT_USUARIO").references(() => usuarios.id),
  idTramitePadre: uuid("ID_TRAMITE_PADRE").references((): AnyPgColumn => tramites.id),
});

export const tramitesCamposDatos = pgTable(
  "TRAMITES_CAMPOS_DATOS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idTramite: uuid("ID_TRAMITE").references(() => tramites.id),
    idTipoTramiteCampo: uuid("ID_TIPO_TRAMITE_CAMPO").references(() => tiposTramiteCampos.id),
    valorTexto: text("VALOR_TEXTO"),
    valorNumero: doublePrecision("VALOR_NUMERO"),
    valorFecha: timestamp("VALOR_FECHA", { withTimezone: true }),
    valorBooleano: boolean("VALOR_BOOLEANO"),
    idArchivoAdjunto: uuid("ID_ARCHIVO_ADJUNTO").references(() => archivosAdjuntos.id),
  },
  (table) => [
    // "para cada trámite, un solo registro por tipo de campo" — habilita upsert limpio.
    uniqueIndex("TRAMITES_CAMPOS_DATOS_TRAMITE_CAMPO_UNIQUE").on(table.idTramite, table.idTipoTramiteCampo),
  ],
);

/**
 * Archivos adjuntos: almacenamiento genérico de archivos sobre cualquier
 * registro con ID_ENTIDAD/ID_RELACION (mismo patrón polimórfico que TRAMITES).
 * El archivo real vive en el filesystem de la instancia, nunca en la base —
 * ver ADR 0011.
 */

export const tiposArchivosAdjuntos = pgTable(
  "TIPOS_ARCHIVOS_ADJUNTOS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
    extension: text("EXTENSION"),
    mimetype: text("MIMETYPE"),
    permiteCarga: boolean("PERMITE_CARGA"),
    permiteDownload: boolean("PERMITE_DOWNLOAD"),
    renderizar: boolean("RENDERIZAR"),
  },
  (table) => [uniqueIndex("TIPOS_ARCHIVOS_ADJUNTOS_CODIGO_UNIQUE").on(table.codigo)],
);

export const archivosAdjuntos = pgTable("ARCHIVOS_ADJUNTOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idTipoArchivoAdjunto: uuid("ID_TIPO_ARCHIVO_ADJUNTO").references(() => tiposArchivosAdjuntos.id),
  nombreOriginal: text("NOMBRE_ORIGINAL"),
  rutaArchivo: text("RUTA_ARCHIVO"),
  tamanioBytes: integer("TAMANIO_BYTES"),
  altaFecha: timestamp("ALTA_FECHA", { withTimezone: true }),
  altaUsuario: uuid("ALTA_USUARIO").references(() => usuarios.id),
  auditFecha: timestamp("AUDIT_FECHA", { withTimezone: true }),
  auditUsuario: uuid("AUDIT_USUARIO").references(() => usuarios.id),
});

/**
 * Asociaciones polimórficas de un archivo adjunto — reemplaza a las viejas
 * columnas ARCHIVOS_ADJUNTOS.ID_ENTIDAD/ID_REGISTRO: un mismo archivo puede
 * asociarse a varias entidades (ej. al legajo Y a un movimiento puntual de
 * HISTORIAL). Sin FK real en ID_REGISTRO — mismo criterio polimórfico que
 * TRAMITES.ID_REGISTRO/HISTORIAL.ID_RELACION. Ver domain/archivos-adjuntos.md.
 */
export const archivosAdjuntosEntidades = pgTable(
  "ARCHIVOS_ADJUNTOS_ENTIDADES",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idArchivoAdjunto: uuid("ID_ARCHIVO_ADJUNTO").references(() => archivosAdjuntos.id),
    idEntidad: uuid("ID_ENTIDAD").references(() => entidades.id),
    idRegistro: uuid("ID_REGISTRO"),
  },
  (table) => [
    uniqueIndex("ARCHIVOS_ADJUNTOS_ENTIDADES_UNIQUE").on(table.idArchivoAdjunto, table.idEntidad, table.idRegistro),
  ],
);

/**
 * Generación de documentos: PDF armados a partir de un modelo HTML con
 * placeholders ##CODIGO##, resueltos contra datos de la base y guardados
 * como un ARCHIVOS_ADJUNTOS más — ver domain/generacion-documentos.md.
 */

export const placeholders = pgTable(
  "PLACEHOLDERS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
    // SQL de confianza (ADR 0009): recibe un único $1 jsonb con los datos raíz
    // del llamador, devuelve un valor escalar. Sin recursión — si hace falta
    // componer, se resuelve con SQL nativo dentro de la propia query.
    query: text("QUERY"),
    // Si es exactamente `false`, el resultado NO se escapa antes de insertarlo
    // en el HTML (permite que un placeholder arme HTML de confianza, ej. una
    // tabla). Tratar como "escapar salvo === false" en el código de
    // resolución — un flag en NULL debe quedar seguro por default, no inseguro.
    escapar: boolean("ESCAPAR"),
    comodin: jsonb("COMODIN"),
  },
  (table) => [uniqueIndex("PLACEHOLDERS_CODIGO_UNIQUE").on(table.codigo)],
);

export const plantillasAdjunto = pgTable(
  "PLANTILLAS_ADJUNTOS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    // El ARCHIVOS_ADJUNTOS de una plantilla queda con ID_ENTIDAD/ID_REGISTRO
    // en NULL — es global, se identifica por CODIGO, no por un registro dueño.
    idArchivoAdjunto: uuid("ID_ARCHIVO_ADJUNTO").references(() => archivosAdjuntos.id),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
    descripcion: text("DESCRIPCION"),
  },
  (table) => [
    uniqueIndex("PLANTILLAS_ADJUNTOS_CODIGO_UNIQUE").on(table.codigo),
    uniqueIndex("PLANTILLAS_ADJUNTOS_ARCHIVO_UNIQUE").on(table.idArchivoAdjunto),
  ],
);

export const generacionesDocumento = pgTable("GENERACIONES_DOCUMENTO", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idPlantilla: uuid("ID_PLANTILLA").references(() => plantillasAdjunto.id),
  idEntidad: uuid("ID_ENTIDAD").references(() => entidades.id),
  // Sin FK real (asociación polimórfica) — mismo criterio que ARCHIVOS_ADJUNTOS.ID_REGISTRO.
  idRegistro: uuid("ID_REGISTRO"),
  // Datos raíz que se le pasan a CADA placeholder como su único parámetro $1.
  datos: jsonb("DATOS"),
  // 'pendiente' | 'procesando' | 'completado' | 'error'
  estado: text("ESTADO"),
  idArchivoResultado: uuid("ID_ARCHIVO_RESULTADO").references(() => archivosAdjuntos.id),
  error: text("ERROR"),
  altaFecha: timestamp("ALTA_FECHA", { withTimezone: true }),
  auditFecha: timestamp("AUDIT_FECHA", { withTimezone: true }),
});

/**
 * Acciones externas: puente entre SQL de confianza y trabajo que Postgres no
 * puede hacer solo (pegarle a un webservice, mandar un mail, etc.) — ver
 * domain/acciones-externas.md, ADR 0016. ACCIONES_EXTERNAS/ACCIONES_EXTERNAS_COLA
 * son puramente infraestructura (catálogo + cola genérica) — nunca guardan
 * datos de dominio; cada COMPONENTE que produce datos reales (ej. una
 * cotización) tiene su propia tabla, con una FK de vuelta a la fila de cola
 * que la generó (trazabilidad).
 */

export const accionesExternas = pgTable(
  "ACCIONES_EXTERNAS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
    // Cerrado, mapea a un handler Node registrado a mano
    // (packages/core/src/acciones-externas-handlers.ts). Hoy solo 'consulta_cotizacion'.
    componente: text("COMPONENTE").notNull(),
    // Parámetros FIJOS que el handler necesita (credenciales, config propia del
    // componente) — distinto de ACCIONES_EXTERNAS_COLA.PARAMETROS (dinámico, por llamada).
    parametros: jsonb("PARAMETROS"),
    // Sesión con el servicio externo, cuando el COMPONENTE la necesita (mismo
    // patrón que USUARIOS.TOKEN/TOKEN_EXPIRACION). Ningún handler de este
    // sprint la usa — queda preparada para un COMPONENTE futuro basado en OAuth.
    token: text("TOKEN"),
    tokenExpiracion: timestamp("TOKEN_EXPIRACION", { withTimezone: true }),
    // Si es false, el barrido NO reclama filas pendientes de esta acción aunque
    // existan (pausa manual) — se filtra en la query del barrido, no se toca la fila.
    activo: boolean("ACTIVO").default(true),
    // Si el disparo es por evento (cada llamador inserta su propia fila al
    // toque) o se delega a un proceso batch que inserta una sola vez para que
    // el COMPONENTE barra todo junto. Se crea, NO se usa todavía — ningún
    // código se ramifica según este valor por ahora.
    inmediato: boolean("INMEDIATO").default(true),
    reintentosMax: integer("REINTENTOS_MAX"),
    // Minutos de margen desde ACCIONES_EXTERNAS_COLA.FECHA_ENCOLADO — pasado
    // ese margen, no se reintenta más aunque REINTENTO no haya llegado a REINTENTOS_MAX.
    reintentosMargen: integer("REINTENTOS_MARGEN"),
  },
  (table) => [uniqueIndex("ACCIONES_EXTERNAS_CODIGO_UNIQUE").on(table.codigo)],
);

export const accionesExternasCola = pgTable("ACCIONES_EXTERNAS_COLA", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idAccionExterna: uuid("ID_ACCION_EXTERNA").references(() => accionesExternas.id),
  // DEFAULT alcanza para "setear la fecha salvo que venga en el insert" — no
  // hace falta un trigger aparte, un DEFAULT de columna ya es esa semántica.
  fechaEncolado: timestamp("FECHA_ENCOLADO", { withTimezone: true }).defaultNow(),
  // null = no intentado, 0 = éxito, cualquier otro valor = error (el
  // componente elige el código; el barrido solo distingue 0 de "no-0").
  resultado: integer("RESULTADO"),
  resultadoDesc: text("RESULTADO_DESC"),
  resultadoFecha: timestamp("RESULTADO_FECHA", { withTimezone: true }),
  reintento: integer("REINTENTO").default(0),
  reintentosSuperados: boolean("REINTENTOS_SUPERADOS").default(false),
  // Milisegundos — integer alcanza de sobra para una llamada HTTP puntual.
  tiempoConexion: integer("TIEMPO_CONEXION"),
  idEntidad: uuid("ID_ENTIDAD").references(() => entidades.id),
  // Sin FK real (asociación polimórfica) — mismo criterio que ARCHIVOS_ADJUNTOS.ID_REGISTRO.
  idRegistro: uuid("ID_REGISTRO"),
  // Dinámico, por esta llamada puntual: ID_ENTIDAD/ID_REGISTRO para llamados
  // simples (el componente busca el dato solo), PARAMETROS para llamados
  // complejos (el que encola ya pasa los pares clave/valor).
  parametros: jsonb("PARAMETROS"),
  request: jsonb("REQUEST"),
  response: jsonb("RESPONSE"),
});

/**
 * Cotizaciones: primer consumidor real de Acciones Externas (COMPONENTE
 * 'consulta_cotizacion' contra DolarApi). MONEDAS tiene un registro por tipo
 * de cotización (no un TIPO sobre un único USD) — CODIGO_API es el
 * identificador con el que la fuente externa reconoce ese registro puntual;
 * null = no se consulta a ninguna API (ej. ARS). El handler recorre todas las
 * MONEDAS con CODIGO_API no nulo, sin lista hardcodeada.
 */

export const monedas = pgTable(
  "MONEDAS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
    codigoApi: text("CODIGO_API"),
  },
  (table) => [uniqueIndex("MONEDAS_CODIGO_UNIQUE").on(table.codigo)],
);

export const cotizaciones = pgTable("COTIZACIONES", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idMoneda: uuid("ID_MONEDA").references(() => monedas.id),
  compra: doublePrecision("COMPRA"),
  venta: doublePrecision("VENTA"),
  fechaConsulta: timestamp("FECHA_CONSULTA", { withTimezone: true }),
  // Trazabilidad — qué disparo puntual generó esta fila.
  idAccionExternaCola: uuid("ID_ACCION_EXTERNA_COLA").references(() => accionesExternasCola.id),
});

/**
 * Mensajería: envío de mensajes (mail, SMS, WhatsApp, lo que sea) sobre
 * ACCIONES_EXTERNAS — ver domain/acciones-externas.md. Segundo nivel de cola,
 * anidado bajo ACCIONES_EXTERNAS_COLA: con ACCIONES_EXTERNAS.INMEDIATO=false
 * un solo disparo puede procesar N mensajes, cada uno con su propio destino
 * de reintento (por eso REINTENTO/REINTENTOS_SUPERADOS están acá TAMBIÉN,
 * no solo en ACCIONES_EXTERNAS_COLA).
 */

export const mensajeriaPlantillas = pgTable(
  "MENSAJERIA_PLANTILLAS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
    // HTML del cuerpo del mensaje, con ##CODIGO## — mismo mecanismo que PLANTILLAS_ADJUNTOS.
    idArchivoAdjunto: uuid("ID_ARCHIVO_ADJUNTO").references(() => archivosAdjuntos.id),
    descripcion: text("DESCRIPCION"),
    // También admite ##CODIGO## — se resuelve con el mismo motor que el cuerpo.
    asunto: text("ASUNTO"),
    comodin: jsonb("COMODIN"),
    // Al enviar OK/al agotar reintentos en error, aplica este estímulo sobre
    // (MENSAJERIA_COLA.ID_ENTIDAD, MENSAJERIA_COLA.ID_REGISTRO) — ver mensajeria.ts.
    idEstimuloOk: uuid("ID_ESTIMULO_OK").references(() => estimulos.id),
    observacionOk: text("OBSERVACION_OK"),
    idEstimuloError: uuid("ID_ESTIMULO_ERROR").references(() => estimulos.id),
    observacionError: text("OBSERVACION_ERROR"),
  },
  (table) => [uniqueIndex("MENSAJERIA_PLANTILLAS_CODIGO_UNIQUE").on(table.codigo)],
);

export const mensajeriaCola = pgTable("MENSAJERIA_COLA", {
  id: uuid("ID").primaryKey().defaultRandom(),
  // Qué proveedor la va a mandar — no ACCIONES_EXTERNAS_COLA: un mensaje puede
  // quedar encolado bastante antes de que exista ninguna fila de disparo.
  idAccionExterna: uuid("ID_ACCION_EXTERNA").references(() => accionesExternas.id),
  idMensajeriaPlantilla: uuid("ID_MENSAJERIA_PLANTILLA").references(() => mensajeriaPlantillas.id),
  idEntidad: uuid("ID_ENTIDAD").references(() => entidades.id),
  // Sin FK real (asociación polimórfica) — mismo criterio que ARCHIVOS_ADJUNTOS.ID_REGISTRO.
  idRegistro: uuid("ID_REGISTRO"),
  // Copia de MENSAJERIA_PLANTILLAS.ASUNTO al encolar (todavía sin resolver).
  asunto: text("ASUNTO"),
  // A dónde mandarlo (mail, teléfono, lo que pida el proveedor) — lo interpreta
  // cada COMPONENTE, la cola no le da ningún formato particular.
  destino: text("DESTINO"),
  // Datos raíz para la resolución de placeholders (mismo rol que
  // GENERACIONES_DOCUMENTO.DATOS) — los guarda SP_MENSAJERIA_ENCOLAR.
  datosRaiz: jsonb("DATOS_RAIZ"),
  // Mapa código->valor YA resueltos — lo escribe el componente al mandar, para auditoría (nunca el crudo de DATOS_RAIZ).
  placeholders: jsonb("PLACEHOLDERS"),
  // null = no intentado, 0 = éxito, cualquier otro valor = error — mismo criterio que ACCIONES_EXTERNAS_COLA.
  resultado: integer("RESULTADO"),
  resultadoDesc: text("RESULTADO_DESC"),
  resultadoFecha: timestamp("RESULTADO_FECHA", { withTimezone: true }),
  reintento: integer("REINTENTO").default(0),
  reintentosSuperados: boolean("REINTENTOS_SUPERADOS").default(false),
  fechaEncolado: timestamp("FECHA_ENCOLADO", { withTimezone: true }).defaultNow(),
});

export const mensajeriaColaAdjuntos = pgTable("MENSAJERIA_COLA_ADJUNTOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idMensajeriaCola: uuid("ID_MENSAJERIA_COLA").references(() => mensajeriaCola.id),
  idArchivoAdjunto: uuid("ID_ARCHIVO_ADJUNTO").references(() => archivosAdjuntos.id),
});

/**
 * Procesos: scheduler de tareas periódicas sobre pg_cron (no Node) — ver ADR
 * 0015, domain/procesos.md. Cada PROCESO corre según CRON, dividido en PASOS
 * ordenados (SQL de confianza, dev-only, mismo modelo que ACCIONES.COMANDO,
 * ADR 0009), con auditoría completa y reintento automático retomando desde el
 * paso que falló.
 */

export const procesos = pgTable(
  "PROCESOS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    codigo: text("CODIGO").notNull(),
    nombre: text("NOMBRE").notNull(),
    descripcion: text("DESCRIPCION"),
    // Expresión cron completa (ej. '0 1 * * *') — evaluada contra cron.timezone
    // de esta instalación (config de infraestructura, no columna, ver ADR 0015).
    cron: text("CRON").notNull(),
    activo: boolean("ACTIVO").default(true),
    // Cada cuánto reintentar tras un fallo — null = no reintenta.
    reintentoMinutos: integer("REINTENTO_MINUTOS"),
    // Tope de reintentos antes de darse por vencido — agotarlo NO desactiva el
    // PROCESO, la próxima corrida oficial por CRON arranca de cero igual.
    reintentosMax: integer("REINTENTOS_MAX"),
  },
  (table) => [uniqueIndex("PROCESOS_CODIGO_UNIQUE").on(table.codigo)],
);

export const procesosPasos = pgTable("PROCESOS_PASOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idProceso: uuid("ID_PROCESO").references(() => procesos.id),
  orden: integer("ORDEN").notNull(),
  // Identifica el paso en logs/errores — no es un CODIGO único global.
  nombre: text("NOMBRE").notNull(),
  // SQL de confianza (ADR 0009), mismo modelo que ACCIONES.COMANDO — dev-only,
  // el ABM de PROCESOS no toca esta tabla.
  comando: text("COMANDO").notNull(),
  // Máximo esperado para ESTE paso puntual (no un valor global del PROCESO) —
  // usado por el barrido de huérfanas.
  timeoutMinutos: integer("TIMEOUT_MINUTOS"),
});

/**
 * Auditoría Y cola de disparo a la vez — una fila es tanto "esto hay que
 * correr" como "esto se corrió, así salió". Cubre corridas oficiales,
 * reintentos y disparos manuales por igual (distinguidos por ORIGEN).
 */
export const procesosEjecuciones = pgTable(
  "PROCESOS_EJECUCIONES",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idProceso: uuid("ID_PROCESO").references(() => procesos.id),
    fechaProgramada: timestamp("FECHA_PROGRAMADA", { withTimezone: true }).notNull(),
    numeroIntento: integer("NUMERO_INTENTO").default(1),
    // Si es reintento, la ejecución que falló.
    idEjecucionOrigen: uuid("ID_EJECUCION_ORIGEN").references((): AnyPgColumn => procesosEjecuciones.id),
    // 'pendiente' / 'procesando' / 'completado' / 'error'
    estado: text("ESTADO").notNull().default("pendiente"),
    // Arranque de TODA la ejecución.
    fechaInicio: timestamp("FECHA_INICIO", { withTimezone: true }),
    // Arranque del PASO actualmente en curso — distinto de FECHA_INICIO; es lo
    // que compara el barrido de huérfanas contra PROCESOS_PASOS.TIMEOUT_MINUTOS.
    fechaInicioPaso: timestamp("FECHA_INICIO_PASO", { withTimezone: true }),
    fechaFin: timestamp("FECHA_FIN", { withTimezone: true }),
    error: text("ERROR"),
    // Hasta dónde llegó bien.
    idUltimoPasoOk: uuid("ID_ULTIMO_PASO_OK").references(() => procesosPasos.id),
    // Cuál rompió (si ESTADO='error' y se llegó a capturar la excepción).
    idPasoError: uuid("ID_PASO_ERROR").references(() => procesosPasos.id),
    // Desde qué paso arranca ESTA ejecución — null = desde el primero.
    idPasoDesde: uuid("ID_PASO_DESDE").references(() => procesosPasos.id),
    // 'cron' / 'manual' / 'reintento'
    origen: text("ORIGEN").notNull(),
    // Quién lo disparó, si ORIGEN='manual'.
    idUsuarioDisparo: uuid("ID_USUARIO_DISPARO").references(() => usuarios.id),
  },
  (table) => [
    // Dedup: aunque haya varios ejecutores en paralelo y el evaluador corra en
    // distintos ticks, nunca se duplica un disparo para el mismo instante programado.
    uniqueIndex("PROCESOS_EJECUCIONES_PROCESO_FECHA_UNIQUE").on(table.idProceso, table.fechaProgramada),
  ],
);

/**
 * Historial detallado, un registro por cada INTENTO de cada paso dentro de una
 * ejecución — a diferencia de PROCESOS_EJECUCIONES (que solo guarda el ÚLTIMO
 * puntero de progreso), esta tabla da la línea de tiempo completa.
 */
export const procesosEjecucionesPasos = pgTable("PROCESOS_EJECUCIONES_PASOS", {
  id: uuid("ID").primaryKey().defaultRandom(),
  idEjecucion: uuid("ID_EJECUCION").references(() => procesosEjecuciones.id),
  idPaso: uuid("ID_PASO").references(() => procesosPasos.id),
  fechaInicio: timestamp("FECHA_INICIO", { withTimezone: true }).notNull(),
  fechaFin: timestamp("FECHA_FIN", { withTimezone: true }),
  // 'procesando' / 'completado' / 'error'
  estado: text("ESTADO").notNull(),
  error: text("ERROR"),
});
