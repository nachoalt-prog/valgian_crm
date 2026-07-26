import { and, eq } from "drizzle-orm";
import {
  db,
  closeDb,
  usuarios,
  perfiles,
  interfaz,
  herramientas,
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
} from "@valgian/db";
import { hashPassword } from "./auth/password";

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
      colorPrimario: "oklch(0.72 0.14 192)",
      colorSecundario: "oklch(0.55 0.22 285)",
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
      colorPrimario: "oklch(0.75 0.15 55)",
      colorSecundario: "oklch(0.6 0.2 340)",
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

async function ensurePermisoGestion(idPerfil: string, idHerramienta: string) {
  const [existente] = await db
    .select()
    .from(permisos)
    .where(and(eq(permisos.idPerfil, idPerfil), eq(permisos.idHerramienta, idHerramienta)));
  if (existente) return existente;

  const [creado] = await db.insert(permisos).values({ idPerfil, idHerramienta, gestionar: true }).returning();
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
  // Estas dos no se navegan desde el sidebar — se cargan embebidas dentro de un
  // LAYOUTS_LEGAJO dentro del modal de legajo abierto desde Bandejas.
  const herramientaLegajoDatos = await ensureHerramienta("LEGAJO_DAT_1", "Datos de Legajo", "legajo_dat_1.gestionar");
  const herramientaLegajoClientes = await ensureHerramienta("LEGAJO_CLI_1", "ABM de Clientes (Legajo)", "legajo_cli_1.gestionar");

  // Admin tiene acceso de gestión completo a todas las herramientas — la existencia
  // de la fila en PERMISOS ya implica acceso de lectura (no hay columna VER).
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
    herramientaLegajoDatos,
    herramientaLegajoClientes,
  ]) {
    await ensurePermisoGestion(perfilAdmin.id, h.id);
  }

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
  await ensureMenuOpcion(menuHerramientas.id, herramientaBandejas.id, "bandejas", "Bandejas", "icon.bandejas", 1);

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
