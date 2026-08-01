import { eq, and, isNull } from "drizzle-orm";
import {
  db,
  closeDb,
  perfiles,
  caracteres,
  entidades,
  estrategias,
  estados,
  filtros,
  bandejas,
  bandejasFiltros,
  bandejasPerfiles,
  reportes,
  reportesFiltros,
  reportesPerfiles,
  herramientas,
  layoutsLegajo,
  layoutsLegajoSolapas,
  estimulos,
  transiciones,
  perfilesEstimulos,
  categoriasTiposTramite,
  tiposTramite,
  tiposCampos,
} from "@valgian/db";

/**
 * Seed de configuración modelo — reusable como base de una instalación rápida
 * (a diferencia de packages/core/src/seed-demo.ts, que trae datos ficticios
 * de prueba). Ver docs/desarrollo-local.md, sección "Los 3 seeds".
 *
 * Depende de packages/core/src/seed.ts (usuario admin, ENTIDADES).
 */

async function getPerfilAdmin() {
  const [admin] = await db.select().from(perfiles).where(eq(perfiles.codigo, "admin"));
  if (!admin) throw new Error('No existe PERFILES.CODIGO = "admin" — corré el seed principal ("pnpm db:seed") primero.');
  return admin;
}

async function getEntidadPorCodigo(codigo: string) {
  const [entidad] = await db.select().from(entidades).where(eq(entidades.codigo, codigo));
  if (!entidad) throw new Error(`No existe ENTIDADES.CODIGO = "${codigo}" — corré el seed principal primero.`);
  return entidad;
}

async function ensureCaracter(codigo: string, nombre: string) {
  const [existente] = await db.select().from(caracteres).where(eq(caracteres.codigo, codigo));
  if (existente) return existente;

  const [creado] = await db.insert(caracteres).values({ codigo, nombre }).returning();
  return creado;
}

async function ensureEstrategia(codigo: string, nombre: string, idEntidad: string) {
  const [existente] = await db.select().from(estrategias).where(eq(estrategias.codigo, codigo));
  if (existente) return existente;

  const [creada] = await db.insert(estrategias).values({ codigo, nombre, idEntidad }).returning();
  return creada;
}

async function ensureEstado(idEstrategia: string, codigo: string, nombre: string, esInicial: boolean, esFinal: boolean) {
  const [existente] = await db
    .select()
    .from(estados)
    .where(and(eq(estados.idEstrategia, idEstrategia), eq(estados.codigo, codigo)));
  if (existente) return existente;

  const [creado] = await db.insert(estados).values({ idEstrategia, codigo, nombre, esInicial, esFinal }).returning();
  return creado;
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
  // Un mismo FILTRO puede repetirse en la misma bandeja pegado a otro CAMPO
  // (ej. "select_usuarios" para alta_usuario_id Y audit_usuario_id) — la
  // idempotencia tiene que considerar el CAMPO, no solo bandeja+filtro.
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

async function ensureReporte(codigo: string, nombre: string, descripcion: string, query: string, columnas: unknown) {
  const [existente] = await db.select().from(reportes).where(eq(reportes.codigo, codigo));
  if (existente) return existente;

  const [creado] = await db.insert(reportes).values({ codigo, nombre, descripcion, query, columnas }).returning();
  return creado;
}

async function ensureReporteFiltro(idReporte: string, idFiltro: string, campo: string, orden: number) {
  const [existente] = await db
    .select()
    .from(reportesFiltros)
    .where(and(eq(reportesFiltros.idReporte, idReporte), eq(reportesFiltros.idFiltro, idFiltro), eq(reportesFiltros.campo, campo)));
  if (existente) return existente;

  const [creado] = await db.insert(reportesFiltros).values({ idReporte, idFiltro, campo, orden }).returning();
  return creado;
}

async function ensureReportePerfil(idReporte: string, idPerfil: string) {
  const [existente] = await db
    .select()
    .from(reportesPerfiles)
    .where(and(eq(reportesPerfiles.idReporte, idReporte), eq(reportesPerfiles.idPerfil, idPerfil)));
  if (existente) return existente;

  const [creado] = await db.insert(reportesPerfiles).values({ idReporte, idPerfil }).returning();
  return creado;
}

async function getHerramientaPorCodigo(codigo: string) {
  const [herramienta] = await db.select().from(herramientas).where(eq(herramientas.codigo, codigo));
  if (!herramienta) throw new Error(`No existe HERRAMIENTAS.CODIGO = "${codigo}" — corré el seed principal primero.`);
  return herramienta;
}

async function ensureLayout(codigo: string, nombre: string) {
  const [existente] = await db.select().from(layoutsLegajo).where(eq(layoutsLegajo.codigo, codigo));
  if (existente) return existente;

  const [creado] = await db.insert(layoutsLegajo).values({ codigo, nombre }).returning();
  return creado;
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

async function ensureBandejaLayout(idBandeja: string, idLayout: string) {
  await db.update(bandejas).set({ idLayout }).where(and(eq(bandejas.id, idBandeja), isNull(bandejas.idLayout)));
}

async function ensureBandejaTipoApertura(idBandeja: string, tipoApertura: string) {
  await db.update(bandejas).set({ tipoApertura }).where(and(eq(bandejas.id, idBandeja), isNull(bandejas.tipoApertura)));
}

async function ensureEstimulo(idEstrategia: string, codigo: string, nombre: string) {
  const [existente] = await db.select().from(estimulos).where(and(eq(estimulos.idEstrategia, idEstrategia), eq(estimulos.codigo, codigo)));
  if (existente) return existente;

  const [creado] = await db.insert(estimulos).values({ idEstrategia, codigo, nombre }).returning();
  return creado;
}

async function ensureTransicion(idEstrategia: string, idEstado0: string, idEstimulo: string, idEstado1: string) {
  const [existente] = await db
    .select()
    .from(transiciones)
    .where(and(eq(transiciones.idEstrategia, idEstrategia), eq(transiciones.idEstado0, idEstado0), eq(transiciones.idEstimulo, idEstimulo)));
  if (existente) return existente;

  const [creada] = await db.insert(transiciones).values({ idEstrategia, idEstado0, idEstimulo, idEstado1 }).returning();
  return creada;
}

async function ensurePerfilEstimulo(idPerfil: string, idEstimulo: string) {
  const [existente] = await db
    .select()
    .from(perfilesEstimulos)
    .where(and(eq(perfilesEstimulos.idPerfil, idPerfil), eq(perfilesEstimulos.idEstimulo, idEstimulo)));
  if (existente) return existente;

  const [creada] = await db.insert(perfilesEstimulos).values({ idPerfil, idEstimulo }).returning();
  return creada;
}

async function ensureTipoCampo(codigo: string, nombre: string) {
  const [existente] = await db.select().from(tiposCampos).where(eq(tiposCampos.codigo, codigo));
  if (existente) return existente;

  const [creado] = await db.insert(tiposCampos).values({ codigo, nombre }).returning();
  return creado;
}

const BANDEJA_LEGAJOS_QUERY = `
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
`.trim();

const BANDEJA_LEGAJOS_COLUMNAS = [
  { campo: "numero", label: "Nro. Legajo" },
  { campo: "titular", label: "Titular" },
  { campo: "documento", label: "Documento" },
  { campo: "estado", label: "Estado", tipo: "badge" },
  { campo: "alta_fecha", label: "Alta", tipo: "fecha" },
];

async function main() {
  await ensureCaracter("secundario", "Secundario");
  await ensureCaracter("pariente", "Pariente");

  const entidadLegajos = await getEntidadPorCodigo("legajos");
  const estrategiaLegajos = await ensureEstrategia("STD_LEGAJO_1", "Estrategia estándar legajos 1", entidadLegajos.id);
  const estadoActivo = await ensureEstado(estrategiaLegajos.id, "activo", "Activo", true, false);
  const estadoBaja = await ensureEstado(estrategiaLegajos.id, "baja", "Baja", false, true);

  const estimuloGestion = await ensureEstimulo(estrategiaLegajos.id, "gestion", "Gestión");
  const estimuloBajaLegajo = await ensureEstimulo(estrategiaLegajos.id, "baja", "Baja");
  const estimuloReactivar = await ensureEstimulo(estrategiaLegajos.id, "reactivar", "Reactivar");

  await ensureTransicion(estrategiaLegajos.id, estadoActivo.id, estimuloGestion.id, estadoActivo.id);
  await ensureTransicion(estrategiaLegajos.id, estadoActivo.id, estimuloBajaLegajo.id, estadoBaja.id);
  await ensureTransicion(estrategiaLegajos.id, estadoBaja.id, estimuloReactivar.id, estadoActivo.id);

  // Cada FILTRO acá tiene su propio label — aunque compartan TIPO ("texto_like"),
  // son filtros semánticamente distintos, no el mismo filtro reusado. La reusabilidad
  // real de un FILTRO entra en juego cuando OTRA bandeja lo pega a un CAMPO distinto
  // (ej. "select_usuarios" reusado ahí con otro alias) — ver domain/bandejas.md.
  // "fecha_alta" y "select_usuarios" quedan con nombre genérico a propósito —
  // son reusables tal cual por la bandeja de Trámites más abajo (mismo FILTRO,
  // distinto CAMPO de la bandeja). Los demás SÍ son específicos del dominio de
  // legajos (la query de filtroEstado hardcodea STD_LEGAJO_1, y "Titular" solo
  // existe en legajos/clientes), así que llevan la aclaración en el nombre.
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

  const bandejaLegajos = await ensureBandeja("legajos", "Legajos", BANDEJA_LEGAJOS_QUERY, BANDEJA_LEGAJOS_COLUMNAS);

  await ensureBandejaFiltro(bandejaLegajos.id, filtroNumero.id, "numero", 1);
  await ensureBandejaFiltro(bandejaLegajos.id, filtroEstado.id, "estado_id", 2);
  await ensureBandejaFiltro(bandejaLegajos.id, filtroFechaAlta.id, "alta_fecha", 3);
  await ensureBandejaFiltro(bandejaLegajos.id, filtroUsuarios.id, "alta_usuario_id", 4);
  await ensureBandejaFiltro(bandejaLegajos.id, filtroApellidoTitular.id, "titular_apellido", 5);
  await ensureBandejaFiltro(bandejaLegajos.id, filtroNombreTitular.id, "titular_nombre", 6);
  await ensureBandejaFiltro(bandejaLegajos.id, filtroDocumentoTitular.id, "titular_documento", 7);

  const perfilAdmin = await getPerfilAdmin();
  await ensureBandejaPerfil(bandejaLegajos.id, perfilAdmin.id);

  // Admin puede aplicar los 3 estímulos de STD_LEGAJO_1 — sin esto, la herramienta
  // "Gestión de Entidad" no le mostraría ningún estímulo aunque tenga permiso sobre ella.
  await ensurePerfilEstimulo(perfilAdmin.id, estimuloGestion.id);
  await ensurePerfilEstimulo(perfilAdmin.id, estimuloBajaLegajo.id);
  await ensurePerfilEstimulo(perfilAdmin.id, estimuloReactivar.id);

  const herramientaLegajoDatos = await getHerramientaPorCodigo("LEGAJO_DAT_1");
  const herramientaLegajoClientes = await getHerramientaPorCodigo("LEGAJO_CLI_1");
  const herramientaGestionEntidad = await getHerramientaPorCodigo("GESTION_ENTIDAD_1");
  const herramientaHistorial = await getHerramientaPorCodigo("HISTORIAL_1");
  const herramientaTramites = await getHerramientaPorCodigo("TRAMITES_1");
  const herramientaArchivosAdjuntos = await getHerramientaPorCodigo("LEGAJO_ADJ_1");

  const layoutDefault = await ensureLayout("layout_legajo_default_1", "Layout Legajo Default 1");
  await ensureLayoutSolapa(layoutDefault.id, 1, "Datos", herramientaLegajoDatos.id, true);
  await ensureLayoutSolapa(layoutDefault.id, 2, "Clientes", herramientaLegajoClientes.id, true);
  await ensureLayoutSolapa(layoutDefault.id, 3, "Gestión", herramientaGestionEntidad.id, true);
  await ensureLayoutSolapa(layoutDefault.id, 4, "Historial", herramientaHistorial.id, true);
  await ensureLayoutSolapa(layoutDefault.id, 5, "Trámites", herramientaTramites.id, true);
  await ensureLayoutSolapa(layoutDefault.id, 6, "Adjuntos", herramientaArchivosAdjuntos.id, true);
  // El resto de las solapas (7 a 10) no tienen fila — quedan ocultas y vacías por defecto.

  await ensureBandejaLayout(bandejaLegajos.id, layoutDefault.id);

  // --- Trámites ---

  const entidadTramites = await getEntidadPorCodigo("tramites");
  const estrategiaTramites = await ensureEstrategia("STD_TRAMITE_1", "Estrategia estándar trámites 1", entidadTramites.id);
  const estadoIniciado = await ensureEstado(estrategiaTramites.id, "iniciado", "Iniciado", true, false);
  const estadoResuelto = await ensureEstado(estrategiaTramites.id, "resuelto", "Resuelto", false, true);

  const estimuloActualizar = await ensureEstimulo(estrategiaTramites.id, "actualizar", "Actualizar");
  const estimuloResolver = await ensureEstimulo(estrategiaTramites.id, "resolver", "Resolver");
  const estimuloReabrir = await ensureEstimulo(estrategiaTramites.id, "reabrir", "Reabrir");

  await ensureTransicion(estrategiaTramites.id, estadoIniciado.id, estimuloActualizar.id, estadoIniciado.id);
  await ensureTransicion(estrategiaTramites.id, estadoIniciado.id, estimuloResolver.id, estadoResuelto.id);
  await ensureTransicion(estrategiaTramites.id, estadoResuelto.id, estimuloReabrir.id, estadoIniciado.id);

  // Mismo motivo que con STD_LEGAJO_1: sin esto el Modal de Trámites no le
  // mostraría ningún estímulo al admin aunque tenga permiso sobre la herramienta.
  await ensurePerfilEstimulo(perfilAdmin.id, estimuloActualizar.id);
  await ensurePerfilEstimulo(perfilAdmin.id, estimuloResolver.id);
  await ensurePerfilEstimulo(perfilAdmin.id, estimuloReabrir.id);

  await ensureTipoCampo("INPUT_TEXT", "Texto");
  await ensureTipoCampo("INPUT_DATETIME", "Fecha y hora");
  await ensureTipoCampo("INPUT_EMAIL", "Email");
  await ensureTipoCampo("INPUT_NUMBER", "Número");
  await ensureTipoCampo("INPUT_TEL", "Teléfono");
  await ensureTipoCampo("INPUT_RANGE", "Rango numérico");
  await ensureTipoCampo("INPUT_CHECKBOX", "Casilla de verificación");
  await ensureTipoCampo("INPUT_RADIO", "Opción única (radio)");
  await ensureTipoCampo("FILE", "Archivo");
  await ensureTipoCampo("SELECT", "Desplegable");
  await ensureTipoCampo("SELECT_MULTIPLE", "Desplegable múltiple");

  const filtroTipoTramite = await ensureFiltro(
    "select_tipos_tramite",
    "Tipo de Trámite",
    "select",
    `SELECT "ID" AS value, "NOMBRE" AS label FROM "TIPOS_TRAMITE" ORDER BY "NOMBRE"`,
  );
  const filtroEstadoTramite = await ensureFiltro(
    "select_estados_tramites",
    "Estado (Trámite)",
    "select",
    `SELECT "ID" AS value, "NOMBRE" AS label FROM "ESTADOS" WHERE "ID_ESTRATEGIA" = (SELECT "ID" FROM "ESTRATEGIAS" WHERE "CODIGO" = 'STD_TRAMITE_1') ORDER BY "NOMBRE"`,
  );
  const filtroFechaAudit = await ensureFiltro("fecha_audit", "Fecha de Gestión", "fecha_rango", null);

  const BANDEJA_TRAMITES_QUERY = `
SELECT
  T."ID" AS id,
  TT."NOMBRE" AS tipo_tramite,
  TT."ID" AS tipo_tramite_id,
  E."NOMBRE" AS estado,
  E."ID" AS estado_id,
  T."ID_REGISTRO" AS registro_id,
  COALESCE(L."NUMERO", CL."APELLIDO" || ', ' || CL."NOMBRE", CU."NUMERO") AS registro,
  T."ALTA_FECHA" AS alta_fecha,
  T."ALTA_USUARIO" AS alta_usuario_id,
  T."AUDIT_FECHA" AS audit_fecha,
  T."AUDIT_USUARIO" AS audit_usuario_id
FROM "TRAMITES" T
JOIN "TIPOS_TRAMITE" TT ON TT."ID" = T."ID_TIPO_TRAMITE"
JOIN "ENTIDADES" ENT ON ENT."ID" = TT."ID_ENTIDAD"
LEFT JOIN "ESTADOS" E ON E."ID" = T."ID_ESTADO"
LEFT JOIN "LEGAJOS" L ON ENT."CODIGO" = 'legajos' AND L."ID" = T."ID_REGISTRO"
LEFT JOIN "CLIENTES" CL ON ENT."CODIGO" = 'clientes' AND CL."ID" = T."ID_REGISTRO"
LEFT JOIN "CUENTAS" CU ON ENT."CODIGO" = 'cuentas' AND CU."ID" = T."ID_REGISTRO"
`.trim();

  const BANDEJA_TRAMITES_COLUMNAS = [
    { campo: "tipo_tramite", label: "Tipo de Trámite" },
    { campo: "registro", label: "Sobre" },
    { campo: "estado", label: "Estado", tipo: "badge" },
    { campo: "alta_fecha", label: "Alta", tipo: "fecha" },
    { campo: "audit_fecha", label: "Última gestión", tipo: "fecha" },
  ];

  const bandejaTramites = await ensureBandeja("tramites", "Trámites", BANDEJA_TRAMITES_QUERY, BANDEJA_TRAMITES_COLUMNAS);
  await ensureBandejaTipoApertura(bandejaTramites.id, "tramite");

  await ensureBandejaFiltro(bandejaTramites.id, filtroTipoTramite.id, "tipo_tramite_id", 1);
  await ensureBandejaFiltro(bandejaTramites.id, filtroEstadoTramite.id, "estado_id", 2);
  await ensureBandejaFiltro(bandejaTramites.id, filtroFechaAlta.id, "alta_fecha", 3);
  await ensureBandejaFiltro(bandejaTramites.id, filtroUsuarios.id, "alta_usuario_id", 4);
  await ensureBandejaFiltro(bandejaTramites.id, filtroFechaAudit.id, "audit_fecha", 5);
  await ensureBandejaFiltro(bandejaTramites.id, filtroUsuarios.id, "audit_usuario_id", 6);

  await ensureBandejaPerfil(bandejaTramites.id, perfilAdmin.id);

  // --- Reportes ---

  const filtroEstadoGeneracion = await ensureFiltro(
    "select_estado_generacion",
    "Estado (Generación de Documento)",
    "select",
    `SELECT DISTINCT "ESTADO" AS value, "ESTADO" AS label FROM "GENERACIONES_DOCUMENTO" WHERE "ESTADO" IS NOT NULL ORDER BY 1`,
  );
  const filtroPlantilla = await ensureFiltro(
    "select_plantillas_adjuntos",
    "Plantilla de Documento",
    "select",
    `SELECT "ID" AS value, "NOMBRE" AS label FROM "PLANTILLAS_ADJUNTOS" ORDER BY "NOMBRE"`,
  );

  const REPORTE_AUDITORIA_GENERACIONES_QUERY = `
SELECT
  G."ID" AS id,
  P."NOMBRE" AS plantilla,
  P."ID" AS plantilla_id,
  ENT."NOMBRE" AS entidad,
  G."ESTADO" AS estado,
  G."ERROR" AS error,
  G."ALTA_FECHA" AS alta_fecha,
  G."AUDIT_FECHA" AS audit_fecha,
  AR."NOMBRE_ORIGINAL" AS archivo_resultado
FROM "GENERACIONES_DOCUMENTO" G
LEFT JOIN "PLANTILLAS_ADJUNTOS" P ON P."ID" = G."ID_PLANTILLA"
LEFT JOIN "ENTIDADES" ENT ON ENT."ID" = G."ID_ENTIDAD"
LEFT JOIN "ARCHIVOS_ADJUNTOS" AR ON AR."ID" = G."ID_ARCHIVO_RESULTADO"
`.trim();

  const REPORTE_AUDITORIA_GENERACIONES_COLUMNAS = [
    { campo: "plantilla", label: "Plantilla" },
    { campo: "entidad", label: "Entidad" },
    { campo: "estado", label: "Estado", tipo: "badge" },
    { campo: "alta_fecha", label: "Solicitado", tipo: "fecha" },
    { campo: "audit_fecha", label: "Actualizado", tipo: "fecha" },
    { campo: "archivo_resultado", label: "Archivo generado" },
    { campo: "error", label: "Error" },
  ];

  const reporteAuditoriaGeneraciones = await ensureReporte(
    "auditoria_generaciones_documento",
    "Auditoría de Generación de Documentos",
    "Todas las solicitudes de generación de documentos (GENERACIONES_DOCUMENTO), su estado y el archivo resultante.",
    REPORTE_AUDITORIA_GENERACIONES_QUERY,
    REPORTE_AUDITORIA_GENERACIONES_COLUMNAS,
  );

  await ensureReporteFiltro(reporteAuditoriaGeneraciones.id, filtroEstadoGeneracion.id, "estado", 1);
  await ensureReporteFiltro(reporteAuditoriaGeneraciones.id, filtroPlantilla.id, "plantilla_id", 2);
  await ensureReporteFiltro(reporteAuditoriaGeneraciones.id, filtroFechaAlta.id, "alta_fecha", 3);

  await ensureReportePerfil(reporteAuditoriaGeneraciones.id, perfilAdmin.id);

  // --- Reporte de Cotizaciones ---
  // Query 100% genérica (no referencia nada específico de Argentina) — lo que
  // sí es de Argentina son los datos que hoy pueblan MONEDAS/COTIZACIONES
  // (ver seed-configuracion-argentina.ts y el módulo cotizaciones-argentina).

  const filtroMoneda = await ensureFiltro(
    "select_monedas",
    "Moneda",
    "select",
    `SELECT "ID" AS value, "NOMBRE" AS label FROM "MONEDAS" ORDER BY "NOMBRE"`,
  );
  const filtroFechaCotizacion = await ensureFiltro("fecha_cotizacion", "Fecha de Cotización", "fecha_rango", null);

  const REPORTE_COTIZACIONES_QUERY = `
SELECT
  C."ID" AS id,
  M."NOMBRE" AS moneda,
  M."ID" AS moneda_id,
  C."VENTA" AS venta,
  C."COMPRA" AS compra,
  C."FECHA_CONSULTA" AS fecha
FROM "COTIZACIONES" C
JOIN "MONEDAS" M ON M."ID" = C."ID_MONEDA"
`.trim();

  const REPORTE_COTIZACIONES_COLUMNAS = [
    { campo: "moneda", label: "Moneda" },
    { campo: "venta", label: "Valor Venta" },
    { campo: "compra", label: "Valor Compra" },
    { campo: "fecha", label: "Fecha", tipo: "fecha" },
  ];

  const reporteCotizaciones = await ensureReporte(
    "cotizaciones",
    "Cotizaciones",
    "Histórico de cotizaciones consultadas (COTIZACIONES), por moneda.",
    REPORTE_COTIZACIONES_QUERY,
    REPORTE_COTIZACIONES_COLUMNAS,
  );

  await ensureReporteFiltro(reporteCotizaciones.id, filtroMoneda.id, "moneda_id", 1);
  await ensureReporteFiltro(reporteCotizaciones.id, filtroFechaCotizacion.id, "fecha", 2);

  await ensureReportePerfil(reporteCotizaciones.id, perfilAdmin.id);

  // --- Reporte de Mensajería (MENSAJERIA_COLA) ---

  const filtroPlantillaMensajeria = await ensureFiltro(
    "select_mensajeria_plantillas",
    "Plantilla de Mensajería",
    "select",
    `SELECT "ID" AS value, "NOMBRE" AS label FROM "MENSAJERIA_PLANTILLAS" ORDER BY "NOMBRE"`,
  );
  const filtroFechaEncolado = await ensureFiltro("fecha_encolado", "Fecha de Encolado", "fecha_rango", null);

  const REPORTE_MENSAJERIA_QUERY = `
SELECT
  MC."ID" AS id,
  MC."ID" AS adjuntos_id,
  MP."NOMBRE" AS plantilla,
  MP."ID" AS plantilla_id,
  CASE WHEN MC."RESULTADO" IS NULL THEN 'Pendiente' WHEN MC."RESULTADO" = 0 THEN 'Éxito' ELSE 'Error' END AS resultado,
  MC."RESULTADO_DESC" AS resultado_desc,
  MC."FECHA_ENCOLADO" AS fecha_encolado
FROM "MENSAJERIA_COLA" MC
LEFT JOIN "MENSAJERIA_PLANTILLAS" MP ON MP."ID" = MC."ID_MENSAJERIA_PLANTILLA"
`.trim();

  const REPORTE_MENSAJERIA_COLUMNAS = [
    { campo: "plantilla", label: "Plantilla" },
    { campo: "resultado", label: "Resultado", tipo: "badge" },
    { campo: "resultado_desc", label: "Detalle" },
    { campo: "fecha_encolado", label: "Fecha", tipo: "fecha" },
    { campo: "adjuntos_id", label: "Adjuntos", tipo: "adjuntos" },
  ];

  const reporteMensajeria = await ensureReporte(
    "mensajeria_cola",
    "Mensajería",
    "Todos los mensajes encolados (MENSAJERIA_COLA) — mail, SMS, WhatsApp o lo que sea —, su resultado y los adjuntos de cada uno.",
    REPORTE_MENSAJERIA_QUERY,
    REPORTE_MENSAJERIA_COLUMNAS,
  );

  await ensureReporteFiltro(reporteMensajeria.id, filtroPlantillaMensajeria.id, "plantilla_id", 1);
  await ensureReporteFiltro(reporteMensajeria.id, filtroFechaEncolado.id, "fecha_encolado", 2);

  await ensureReportePerfil(reporteMensajeria.id, perfilAdmin.id);

  console.log("Seed de configuración modelo aplicado (idempotente).");
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed de configuración:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
