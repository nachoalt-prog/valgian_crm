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
  herramientas,
  layoutsLegajo,
  layoutsLegajoSolapas,
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
  const [existente] = await db
    .select()
    .from(bandejasFiltros)
    .where(and(eq(bandejasFiltros.idBandeja, idBandeja), eq(bandejasFiltros.idFiltro, idFiltro)));
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
  const estrategiaLegajos = await ensureEstrategia("legajos", "Legajos", entidadLegajos.id);
  await ensureEstado(estrategiaLegajos.id, "alta", "Alta", true, false);

  // Cada FILTRO acá tiene su propio label — aunque compartan TIPO ("texto_like"),
  // son filtros semánticamente distintos, no el mismo filtro reusado. La reusabilidad
  // real de un FILTRO entra en juego cuando OTRA bandeja lo pega a un CAMPO distinto
  // (ej. "select_usuarios" reusado ahí con otro alias) — ver domain/bandejas.md.
  const filtroNumero = await ensureFiltro("numero_legajo", "Nro. Legajo", "texto_like", null);
  const filtroEstado = await ensureFiltro(
    "select_estados_legajos",
    "Estado",
    "select",
    `SELECT "ID" AS value, "NOMBRE" AS label FROM "ESTADOS" WHERE "ID_ESTRATEGIA" = (SELECT "ID" FROM "ESTRATEGIAS" WHERE "CODIGO" = 'legajos') ORDER BY "NOMBRE"`,
  );
  const filtroFechaAlta = await ensureFiltro("fecha_alta", "Fecha de Alta", "fecha_rango", null);
  const filtroUsuarios = await ensureFiltro(
    "select_usuarios",
    "Usuario",
    "select",
    `SELECT "ID" AS value, "USERNAME" AS label FROM "USUARIOS" ORDER BY "USERNAME"`,
  );
  const filtroApellidoTitular = await ensureFiltro("apellido_titular", "Apellido del Titular", "texto_like", null);
  const filtroNombreTitular = await ensureFiltro("nombre_titular", "Nombre del Titular", "texto_like", null);
  const filtroDocumentoTitular = await ensureFiltro("documento_titular", "Nro. Documento del Titular", "texto_like", null);

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

  const herramientaLegajoDatos = await getHerramientaPorCodigo("LEGAJO_DAT_1");
  const herramientaLegajoClientes = await getHerramientaPorCodigo("LEGAJO_CLI_1");

  const layoutDefault = await ensureLayout("layout_legajo_default_1", "Layout Legajo Default 1");
  await ensureLayoutSolapa(layoutDefault.id, 1, "Datos", herramientaLegajoDatos.id, true);
  await ensureLayoutSolapa(layoutDefault.id, 2, "Clientes", herramientaLegajoClientes.id, true);
  await ensureLayoutSolapa(layoutDefault.id, 3, "Solapa 3", null, true);
  // El resto de las solapas (4 a 10) no tienen fila — quedan ocultas y vacías por defecto.

  await ensureBandejaLayout(bandejaLegajos.id, layoutDefault.id);

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
