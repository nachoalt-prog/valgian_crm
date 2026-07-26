import { sql } from "drizzle-orm";
import { pgTable, uuid, text, boolean, integer, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Naming: los nombres de tabla/columna siguen MAYÚSCULAS_CON_GUION_BAJO
 * tal cual domain/infraestructura.md y domain/core.md — implica identificadores
 * quoteados en el SQL generado. Nullability: todo nullable salvo PK, CODIGO,
 * NOMBRE (regla temporal acordada, domain/core.md "Convenciones generales"),
 * más USERNAME/PASSWORD_HASH en USUARIOS (login no funciona sin esto).
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
    avatarPath: text("AVATAR_PATH"),
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
});

export const permisos = pgTable(
  "PERMISOS",
  {
    id: uuid("ID").primaryKey().defaultRandom(),
    idPerfil: uuid("ID_PERFIL").references(() => perfiles.id),
    idHerramienta: uuid("ID_HERRAMIENTA").references(() => herramientas.id),
    gestionar: boolean("GESTIONAR"),
  },
  (table) => [uniqueIndex("PERMISOS_PERFIL_HERRAMIENTA_UNIQUE").on(table.idPerfil, table.idHerramienta)],
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
  idTransicion: uuid("ID_TRANSICION").references(() => transiciones.id),
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
  },
  (table) => [uniqueIndex("LAYOUTS_LEGAJO_SOLAPAS_LAYOUT_ORDEN_UNIQUE").on(table.idLayout, table.orden)],
);
