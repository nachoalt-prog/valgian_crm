import { and, eq } from "drizzle-orm";
import {
  db,
  closeDb,
  usuarios,
  perfiles,
  interfaz,
  herramientas,
  operaciones,
  permisos,
  menues,
  menuesOpciones,
  interfacesMenues,
  caracteres,
  generos,
  paises,
  provincias,
  tiposDocumento,
  entidades,
  tiposArchivosAdjuntos,
} from "@valgian/db";
import { hashPassword } from "./auth/password";
import { OPERACION_ACCESO } from "./permissions";
import {
  OPERACION_ADJUNTOS_CREAR,
  OPERACION_ADJUNTOS_REEMPLAZAR,
  OPERACION_ADJUNTOS_DESCARGAR,
  OPERACION_ADJUNTOS_GUARDAR,
  OPERACION_ADJUNTOS_BORRAR,
} from "./archivos-adjuntos";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

/**
 * Cada pieza del seed es idempotente por su cuenta (busca por código antes de
 * insertar) — así se puede correr `db:seed` de nuevo después de sumar una
 * herramienta nueva sin tener que resetear la base entera.
 */

async function ensureInterfazDefault() {
  const [existente] = await db.select().from(interfaz).where(eq(interfaz.codigo, "default"));
  if (existente) return existente;

  const [creada] = await db
    .insert(interfaz)
    .values({
      codigo: "default",
      nombre: "Interfaz por defecto",
      fuente: "default",
      // Paleta Valgian — teal/cyan como primario, purple como acento.
      // Ver domain/infraestructura.md (INTERFAZ.COLOR_PRIMARIO/COLOR_SECUNDARIO).
      colorPrimario: "#00BFBB",
      colorSecundario: "#6C50E9",
    })
    .returning();
  return creada;
}

/**
 * Interfaz de prueba, clon de "default" con otra paleta — para validar que
 * toda la app (colores + título) responde a INTERFAZ y no queda hardcodeada.
 * Comparte las mismas relaciones INTERFACES_MENUES que "default".
 */
async function ensureInterfazAlt() {
  const [existente] = await db.select().from(interfaz).where(eq(interfaz.codigo, "alt"));
  if (existente) return existente;

  const [creada] = await db
    .insert(interfaz)
    .values({
      codigo: "alt",
      nombre: "Interfaz Alternativa",
      fuente: "default",
      // Paleta de prueba, deliberadamente distinta de la de "default" (teal/purple):
      // naranja como primario, magenta como acento.
      colorPrimario: "#F59145",
      colorSecundario: "#C841A5",
      titulo: "Valgian (Alt)",
    })
    .returning();
  return creada;
}

async function ensurePerfilAdmin(idInterfaz: string) {
  const [existente] = await db.select().from(perfiles).where(eq(perfiles.codigo, "admin"));
  if (existente) return existente;

  const [creado] = await db.insert(perfiles).values({ codigo: "admin", nombre: "Administrador", idInterfaz }).returning();
  return creado;
}

async function ensureUsuarioAdmin(idPerfil: string) {
  const [existente] = await db.select().from(usuarios).where(eq(usuarios.username, ADMIN_USERNAME));
  if (existente) return { usuario: existente, creado: false };

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const [creado] = await db.insert(usuarios).values({ idPerfil, username: ADMIN_USERNAME, passwordHash }).returning();
  return { usuario: creado, creado: true };
}

async function ensureHerramienta(codigo: string, nombre: string, slug: string) {
  const [existente] = await db.select().from(herramientas).where(eq(herramientas.codigo, codigo));
  if (existente) return existente;

  const [creada] = await db.insert(herramientas).values({ codigo, nombre, slug }).returning();
  return creada;
}

async function ensureOperacion(idHerramienta: string, codigo: string, nombre: string) {
  const [existente] = await db
    .select()
    .from(operaciones)
    .where(and(eq(operaciones.idHerramienta, idHerramienta), eq(operaciones.codigo, codigo)));
  if (existente) return existente;

  const [creada] = await db.insert(operaciones).values({ idHerramienta, codigo, nombre }).returning();
  return creada;
}

async function ensurePermisoOperacion(idPerfil: string, idOperacion: string) {
  const [existente] = await db
    .select()
    .from(permisos)
    .where(and(eq(permisos.idPerfil, idPerfil), eq(permisos.idOperacion, idOperacion)));
  if (existente) return existente;

  const [creado] = await db.insert(permisos).values({ idPerfil, idOperacion }).returning();
  return creado;
}

async function ensureMenu(codigo: string, nombre: string) {
  const [existente] = await db.select().from(menues).where(eq(menues.codigo, codigo));
  if (existente) return existente;

  const [creado] = await db.insert(menues).values({ codigo, nombre }).returning();
  return creado;
}

async function ensureMenuOpcion(
  idMenu: string,
  idHerramienta: string,
  codigo: string,
  nombre: string,
  icono: string,
  orden: number,
) {
  const [existente] = await db.select().from(menuesOpciones).where(eq(menuesOpciones.codigo, codigo));
  if (existente) return existente;

  const [creada] = await db.insert(menuesOpciones).values({ idMenu, idHerramienta, codigo, nombre, icono, orden }).returning();
  return creada;
}

async function ensureInterfazMenu(idInterfaz: string, idMenu: string) {
  const [existente] = await db
    .select()
    .from(interfacesMenues)
    .where(and(eq(interfacesMenues.idInterfaz, idInterfaz), eq(interfacesMenues.idMenu, idMenu)));
  if (existente) return existente;

  const [creada] = await db.insert(interfacesMenues).values({ idInterfaz, idMenu }).returning();
  return creada;
}

async function ensureCaracter(codigo: string, nombre: string) {
  const [existente] = await db.select().from(caracteres).where(eq(caracteres.codigo, codigo));
  if (existente) return existente;

  const [creado] = await db.insert(caracteres).values({ codigo, nombre }).returning();
  return creado;
}

async function ensureGenero(codigo: string, nombre: string) {
  const [existente] = await db.select().from(generos).where(eq(generos.codigo, codigo));
  if (existente) return existente;

  const [creado] = await db.insert(generos).values({ codigo, nombre }).returning();
  return creado;
}

async function ensurePais(codigo: string, nombre: string) {
  const [existente] = await db.select().from(paises).where(eq(paises.codigo, codigo));
  if (existente) return existente;

  const [creado] = await db.insert(paises).values({ codigo, nombre }).returning();
  return creado;
}

async function ensureProvincia(idPais: string, codigo: string, nombre: string) {
  const [existente] = await db.select().from(provincias).where(eq(provincias.codigo, codigo));
  if (existente) return existente;

  const [creada] = await db.insert(provincias).values({ idPais, codigo, nombre }).returning();
  return creada;
}

async function ensureTipoDocumento(codigo: string, nombre: string) {
  const [existente] = await db.select().from(tiposDocumento).where(eq(tiposDocumento.codigo, codigo));
  if (existente) return existente;

  const [creado] = await db.insert(tiposDocumento).values({ codigo, nombre }).returning();
  return creado;
}

async function ensureTipoArchivoAdjunto(params: {
  codigo: string;
  nombre: string;
  extension: string;
  mimetype: string;
  permiteCarga: boolean;
  permiteDownload: boolean;
  renderizar: boolean;
}) {
  const [existente] = await db.select().from(tiposArchivosAdjuntos).where(eq(tiposArchivosAdjuntos.codigo, params.codigo));
  if (existente) return existente;

  const [creado] = await db.insert(tiposArchivosAdjuntos).values(params).returning();
  return creado;
}

async function ensureEntidad(codigo: string, nombre: string) {
  const [existente] = await db.select().from(entidades).where(eq(entidades.codigo, codigo));
  if (existente) return existente;

  const [creada] = await db.insert(entidades).values({ codigo, nombre }).returning();
  return creada;
}

/**
 * Provincias argentinas con código ISO 3166-2:AR — las 23 provincias más la
 * Ciudad Autónoma de Buenos Aires (24 jurisdicciones en total). "Tierra del
 * Fuego, Antártida e Islas del Atlántico Sur" es una única provincia (nombre
 * oficial completo), no dos.
 */
const PROVINCIAS_ARGENTINA: Array<[codigo: string, nombre: string]> = [
  ["AR-B", "Buenos Aires"],
  ["AR-C", "Ciudad Autónoma de Buenos Aires"],
  ["AR-K", "Catamarca"],
  ["AR-H", "Chaco"],
  ["AR-U", "Chubut"],
  ["AR-X", "Córdoba"],
  ["AR-W", "Corrientes"],
  ["AR-E", "Entre Ríos"],
  ["AR-P", "Formosa"],
  ["AR-Y", "Jujuy"],
  ["AR-L", "La Pampa"],
  ["AR-F", "La Rioja"],
  ["AR-M", "Mendoza"],
  ["AR-N", "Misiones"],
  ["AR-Q", "Neuquén"],
  ["AR-R", "Río Negro"],
  ["AR-A", "Salta"],
  ["AR-J", "San Juan"],
  ["AR-D", "San Luis"],
  ["AR-Z", "Santa Cruz"],
  ["AR-S", "Santa Fe"],
  ["AR-G", "Santiago del Estero"],
  ["AR-V", "Tierra del Fuego, Antártida e Islas del Atlántico Sur"],
  ["AR-T", "Tucumán"],
];

async function main() {
  const interfazDefault = await ensureInterfazDefault();
  const perfilAdmin = await ensurePerfilAdmin(interfazDefault.id);
  const { creado: usuarioCreado } = await ensureUsuarioAdmin(perfilAdmin.id);

  const herramientaDashboard = await ensureHerramienta("dashboard", "Dashboard", "dashboard.ver");
  const herramientaUsuarios = await ensureHerramienta("usuarios_perfiles", "Usuarios y Perfiles", "usuarios.gestionar");
  const herramientaMenues = await ensureHerramienta("menues", "Menúes y Opciones", "menues.gestionar");
  const herramientaInterfaces = await ensureHerramienta("interfaces", "Interfaces", "interfaces.gestionar");
  const herramientaPermisos = await ensureHerramienta("permisos", "Permisos", "permisos.gestionar");
  const herramientaProductos = await ensureHerramienta("productos", "Productos y Sub-productos", "productos.gestionar");
  const herramientaBandejas = await ensureHerramienta("bandejas", "Bandejas", "bandejas.ver");
  const herramientaFiltros = await ensureHerramienta("filtros", "Filtros", "filtros.gestionar");
  const herramientaBandejasAdmin = await ensureHerramienta("bandejas_admin", "Bandejas (ABM)", "bandejas_admin.gestionar");
  const herramientaLayoutsLegajo = await ensureHerramienta("layouts_legajo", "Layouts de Legajo", "layouts_legajo.gestionar");
  const herramientaPerfilesEstimulos = await ensureHerramienta("perfiles_estimulos", "Perfiles-Estímulos", "perfiles_estimulos.gestionar");
  const herramientaPlaceholders = await ensureHerramienta("placeholders", "Placeholders", "placeholders.gestionar");
  const herramientaPlantillasAdjuntos = await ensureHerramienta("plantillas_adjuntos", "Plantillas de Documento", "plantillas_adjuntos.gestionar");
  const herramientaTiposAdjuntos = await ensureHerramienta("tipos_archivos_adjuntos", "Tipos de Adjunto", "tipos_archivos_adjuntos.gestionar");
  const herramientaReportes = await ensureHerramienta("reportes", "Reportes", "reportes.ver");
  const herramientaReportesAdmin = await ensureHerramienta("reportes_admin", "Reportes (ABM)", "reportes_admin.gestionar");
  const herramientaMonedas = await ensureHerramienta("monedas", "Monedas", "monedas.gestionar");
  const herramientaMensajeriaPlantillas = await ensureHerramienta("mensajeria_plantillas", "Plantillas de Mensajería", "mensajeria_plantillas.gestionar");
  const herramientaAccionesExternas = await ensureHerramienta("acciones_externas", "Acciones Externas", "acciones_externas.gestionar");
  const herramientaProcesos = await ensureHerramienta("procesos", "Procesos", "procesos.gestionar");
  // Estas no se navegan desde el sidebar — se cargan embebidas dentro de un
  // LAYOUTS_LEGAJO dentro del modal de legajo abierto desde Bandejas.
  const herramientaLegajoDatos = await ensureHerramienta("LEGAJO_DAT_1", "Datos de Legajo", "legajo_dat_1.gestionar");
  const herramientaLegajoClientes = await ensureHerramienta("LEGAJO_CLI_1", "ABM de Clientes (Legajo)", "legajo_cli_1.gestionar");
  const herramientaGestionEntidad = await ensureHerramienta("GESTION_ENTIDAD_1", "Gestión de Entidad", "gestion_entidad_1.gestionar");
  const herramientaHistorial = await ensureHerramienta("HISTORIAL_1", "Historial", "historial_1.gestionar");
  const herramientaTramites = await ensureHerramienta("TRAMITES_1", "Trámites", "tramites_1.gestionar");
  const herramientaArchivosAdjuntos = await ensureHerramienta("LEGAJO_ADJ_1", "Archivos Adjuntos (Legajo)", "legajo_adj_1.gestionar");

  // Admin tiene acceso completo a todas las herramientas — de momento cada una
  // tiene una única operación 'Acceso'; la existencia de la fila en PERMISOS
  // para esa operación ya implica acceso (no hay columna VER separada).
  for (const h of [
    herramientaDashboard,
    herramientaUsuarios,
    herramientaMenues,
    herramientaInterfaces,
    herramientaPermisos,
    herramientaProductos,
    herramientaBandejas,
    herramientaFiltros,
    herramientaBandejasAdmin,
    herramientaLayoutsLegajo,
    herramientaPerfilesEstimulos,
    herramientaPlaceholders,
    herramientaPlantillasAdjuntos,
    herramientaTiposAdjuntos,
    herramientaReportes,
    herramientaReportesAdmin,
    herramientaMonedas,
    herramientaMensajeriaPlantillas,
    herramientaAccionesExternas,
    herramientaProcesos,
    herramientaLegajoDatos,
    herramientaLegajoClientes,
    herramientaGestionEntidad,
    herramientaHistorial,
    herramientaTramites,
    herramientaArchivosAdjuntos,
  ]) {
    const operacionAcceso = await ensureOperacion(h.id, OPERACION_ACCESO, "Acceso");
    await ensurePermisoOperacion(perfilAdmin.id, operacionAcceso.id);
  }

  // LEGAJO_ADJ_1: primer uso real de operaciones granulares más allá de Acceso.
  for (const [codigo, nombre] of [
    [OPERACION_ADJUNTOS_CREAR, "Crear"],
    [OPERACION_ADJUNTOS_REEMPLAZAR, "Reemplazar"],
    [OPERACION_ADJUNTOS_DESCARGAR, "Descargar"],
    [OPERACION_ADJUNTOS_GUARDAR, "Guardar"],
    [OPERACION_ADJUNTOS_BORRAR, "Borrar"],
  ]) {
    const operacion = await ensureOperacion(herramientaArchivosAdjuntos.id, codigo, nombre);
    await ensurePermisoOperacion(perfilAdmin.id, operacion.id);
  }

  // Ayuda del editor de PARAMETROS en los ABMs de Layouts de Legajo/Menúes —
  // se resetea en cada corrida del seed (no hay ABM para tocarlo a mano
  // todavía, así que no hace falta el criterio de "solo si no existe").
  const SIN_PARAMETROS_GUIA = "De momento esta herramienta no soporta parámetros";
  for (const h of [
    herramientaDashboard,
    herramientaUsuarios,
    herramientaMenues,
    herramientaInterfaces,
    herramientaPermisos,
    herramientaProductos,
    herramientaBandejas,
    herramientaFiltros,
    herramientaBandejasAdmin,
    herramientaLayoutsLegajo,
    herramientaPerfilesEstimulos,
    herramientaPlaceholders,
    herramientaPlantillasAdjuntos,
    herramientaTiposAdjuntos,
    herramientaReportes,
    herramientaReportesAdmin,
    herramientaMonedas,
    herramientaMensajeriaPlantillas,
    herramientaLegajoDatos,
    herramientaLegajoClientes,
    herramientaGestionEntidad,
    herramientaHistorial,
    herramientaTramites,
  ]) {
    await db.update(herramientas).set({ parametrosEjemplo: SIN_PARAMETROS_GUIA, parametrosGuia: SIN_PARAMETROS_GUIA }).where(eq(herramientas.id, h.id));
  }
  await db
    .update(herramientas)
    .set({
      parametrosEjemplo: { crear: true, borrar: false, reemplazar: true, descargar: false },
      parametrosGuia:
        "Hoy solo lo interpreta Archivos Adjuntos (claves: crear, reemplazar, descargar, borrar). Vacío = sin restricción extra.",
    })
    .where(eq(herramientas.id, herramientaArchivosAdjuntos.id));

  const menuPrincipal = await ensureMenu("principal", "Principal");
  const menuConfiguracion = await ensureMenu("configuracion", "Configuración");
  const menuHerramientas = await ensureMenu("herramientas", "Herramientas");

  await ensureMenuOpcion(menuPrincipal.id, herramientaDashboard.id, "dashboard", "Dashboard", "icon.dashboard", 1);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaUsuarios.id, "usuarios_perfiles", "Usuarios y Perfiles", "icon.usuarios", 1);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaMenues.id, "menues", "Menúes", "icon.menues", 2);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaInterfaces.id, "interfaces", "Interfaces", "icon.interfaces", 3);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaPermisos.id, "permisos", "Permisos", "icon.permisos", 4);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaProductos.id, "productos", "Productos", "icon.productos", 5);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaFiltros.id, "filtros", "Filtros", "icon.filtros", 6);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaBandejasAdmin.id, "bandejas_admin", "Bandejas", "icon.bandejas", 7);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaLayoutsLegajo.id, "layouts_legajo", "Layouts de Legajo", "icon.layouts", 8);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaPerfilesEstimulos.id, "perfiles_estimulos", "Perfiles-Estímulos", "icon.perfilesEstimulos", 9);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaPlaceholders.id, "placeholders", "Placeholders", "icon.placeholders", 10);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaPlantillasAdjuntos.id, "plantillas_adjuntos", "Plantillas de Documento", "icon.plantillasAdjuntos", 11);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaTiposAdjuntos.id, "tipos_archivos_adjuntos", "Tipos de Adjunto", "icon.tiposAdjuntos", 12);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaReportesAdmin.id, "reportes_admin", "Reportes", "icon.reportes", 13);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaMonedas.id, "monedas", "Monedas", "icon.monedas", 14);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaMensajeriaPlantillas.id, "mensajeria_plantillas", "Plantillas de Mensajería", "icon.mensajeriaPlantillas", 15);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaAccionesExternas.id, "acciones_externas", "Acciones Externas", "icon.accionesExternas", 16);
  await ensureMenuOpcion(menuConfiguracion.id, herramientaProcesos.id, "procesos", "Procesos", "icon.procesos", 17);
  await ensureMenuOpcion(menuHerramientas.id, herramientaBandejas.id, "bandejas", "Bandejas", "icon.bandejas", 1);
  await ensureMenuOpcion(menuHerramientas.id, herramientaReportes.id, "reportes", "Reportes", "icon.reportes", 2);

  await ensureInterfazMenu(interfazDefault.id, menuPrincipal.id);
  await ensureInterfazMenu(interfazDefault.id, menuConfiguracion.id);
  await ensureInterfazMenu(interfazDefault.id, menuHerramientas.id);

  const interfazAlt = await ensureInterfazAlt();
  await ensureInterfazMenu(interfazAlt.id, menuPrincipal.id);
  await ensureInterfazMenu(interfazAlt.id, menuConfiguracion.id);
  await ensureInterfazMenu(interfazAlt.id, menuHerramientas.id);

  await ensureCaracter("titular", "Titular");
  await ensureGenero("M", "Masculino");
  await ensureGenero("F", "Femenino");
  await ensureTipoDocumento("DNI", "Documento Nacional de Identidad");

  const paisArgentina = await ensurePais("AR", "Argentina");
  for (const [codigo, nombre] of PROVINCIAS_ARGENTINA) {
    await ensureProvincia(paisArgentina.id, codigo, nombre);
  }

  await ensureEntidad("legajos", "LEGAJOS");
  await ensureEntidad("clientes", "CLIENTES");
  await ensureEntidad("cuentas", "CUENTAS");
  await ensureEntidad("tramites", "TRAMITES");
  await ensureEntidad("usuarios", "USUARIOS");
  await ensureEntidad("historial", "HISTORIAL");
  // Nombre "lindo" a propósito (no MENSAJERIA_COLA) — a diferencia del resto,
  // esta entidad nunca se muestra como "la tabla X" en ningún lado de negocio,
  // solo la usa el despachador de Acciones Externas para distinguir el modo
  // "mensaje específico" del modo "barrer todo pendiente" — ver domain/acciones-externas.md.
  await ensureEntidad("mensajeria_cola", "Mensaje Encolado");

  // Catálogo de formatos soportados por archivos adjuntos (ver ADR 0011) — no
  // tiene relación con "tipos de documento" semánticos, es puro formato.
  const TIPOS_ARCHIVO: Array<{
    codigo: string;
    nombre: string;
    extension: string;
    mimetype: string;
    permiteCarga: boolean;
    permiteDownload: boolean;
    renderizar: boolean;
  }> = [
    { codigo: "jpg", nombre: "Imagen JPG", extension: "jpg", mimetype: "image/jpeg", permiteCarga: true, permiteDownload: true, renderizar: true },
    { codigo: "jpeg", nombre: "Imagen JPEG", extension: "jpeg", mimetype: "image/jpeg", permiteCarga: true, permiteDownload: true, renderizar: true },
    { codigo: "png", nombre: "Imagen PNG", extension: "png", mimetype: "image/png", permiteCarga: true, permiteDownload: true, renderizar: true },
    { codigo: "gif", nombre: "Imagen GIF", extension: "gif", mimetype: "image/gif", permiteCarga: true, permiteDownload: true, renderizar: true },
    { codigo: "webp", nombre: "Imagen WEBP", extension: "webp", mimetype: "image/webp", permiteCarga: true, permiteDownload: true, renderizar: true },
    { codigo: "pdf", nombre: "Documento PDF", extension: "pdf", mimetype: "application/pdf", permiteCarga: true, permiteDownload: true, renderizar: true },
    { codigo: "txt", nombre: "Texto plano", extension: "txt", mimetype: "text/plain", permiteCarga: true, permiteDownload: true, renderizar: true },
    { codigo: "html", nombre: "HTML", extension: "html", mimetype: "text/html", permiteCarga: true, permiteDownload: true, renderizar: true },
    {
      codigo: "docx",
      nombre: "Word (DOCX)",
      extension: "docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      permiteCarga: true,
      permiteDownload: true,
      renderizar: false,
    },
    {
      codigo: "xlsx",
      nombre: "Excel (XLSX)",
      extension: "xlsx",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      permiteCarga: true,
      permiteDownload: true,
      renderizar: false,
    },
  ];
  for (const tipo of TIPOS_ARCHIVO) {
    await ensureTipoArchivoAdjunto(tipo);
  }

  console.log("Seed aplicado (idempotente).");
  if (usuarioCreado) {
    console.log(`Usuario admin: "${ADMIN_USERNAME}" / "${ADMIN_PASSWORD}" (solo para desarrollo local)`);
  }
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
