import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseCsvSync } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { and, count, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db, queryClient, importadores, importadoresEjecuciones, accionesExternas } from "@valgian/db";
import { encolarAccionExterna, registrarHandlerAccionExterna, finalizarIntentoAccionExterna, type FilaAccionExternaCola } from "./acciones-externas";

/**
 * Motor de importación de archivos — ver ADR 0021, domain/importadores.md.
 * Todo lo que es SQL puro (validar/impactar/mover a histórico/limpiar) vive
 * en el PROCEDURE sp_importar_ejecutar (packages/db/sql/0022_...). Este
 * archivo es la parte que Postgres no puede hacer sola: buscar/leer/mover un
 * archivo del filesystem, y el registro de parsers/cargadores por importador.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../../");

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") return true;
  if (typeof err === "object" && err !== null && "cause" in err) return esViolacionUnica((err as { cause: unknown }).cause);
  return false;
}

function resolverRuta(ruta: string): string {
  return path.isAbsolute(ruta) ? ruta : path.resolve(MONOREPO_ROOT, ruta);
}

// Traduce un patrón estilo SQL LIKE (% = cualquier secuencia, _ = un carácter) a RegExp.
function likeToRegExp(patron: string): RegExp {
  const escapado = patron.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escapado}$`, "i");
}

// Mismo patrón que valida sp_importar_ejecutar antes de interpolar en EXECUTE format() — acá se usa antes de interpolar en SQL dinámico desde Node (introspección de staging).
const IDENTIFICADOR_SIMPLE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// ---------- ABM de IMPORTADORES (patrón "Monedas"/catálogos XCC: Resultado<T>, esViolacionUnica) ----------

const ESTADOS_EJECUCION_ACTIVOS = ["pendiente", "cargando", "validando", "esperando_confirmacion", "impactando"] as const;

export interface ImportadorConEstado {
  id: string;
  codigo: string;
  nombre: string;
  tablaStaging: string;
  spNombre: string;
  extensionesPermitidas: string;
  rutaDirectorio: string | null;
  patronNombreArchivo: string | null;
  tablaHistorico: string | null;
  diasRetencionHistorico: number | null;
  carpetaDestinoProcesados: string | null;
  disparoAutomaticoActivo: boolean | null;
  modoErrorAutomatico: string | null;
  activo: boolean | null;
  /** true si hay una IMPORTADORES_EJECUCIONES en curso (cualquier usuario) — ver ImportadoresTool (spinner). */
  ejecutandose: boolean;
}

export async function listImportadoresAdmin(): Promise<ImportadorConEstado[]> {
  const filas = await db.select().from(importadores).orderBy(importadores.nombre);

  const activas = await db
    .selectDistinct({ idImportador: importadoresEjecuciones.idImportador })
    .from(importadoresEjecuciones)
    .where(inArray(importadoresEjecuciones.estado, ESTADOS_EJECUCION_ACTIVOS));
  const idsActivos = new Set(activas.map((a) => a.idImportador));

  return filas.map((i) => ({ ...i, ejecutandose: idsActivos.has(i.id) }));
}

export interface ImportadorInput {
  codigo: string;
  nombre: string;
  tablaStaging: string;
  spNombre: string;
  extensionesPermitidas: string;
  rutaDirectorio: string | null;
  patronNombreArchivo: string | null;
  tablaHistorico: string | null;
  diasRetencionHistorico: number | null;
  carpetaDestinoProcesados: string | null;
  disparoAutomaticoActivo: boolean;
  modoErrorAutomatico: string | null;
  activo: boolean;
}

export async function createImportador(data: ImportadorInput): Promise<Resultado<typeof importadores.$inferSelect>> {
  try {
    const [fila] = await db.insert(importadores).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un importador con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateImportador(id: string, data: ImportadorInput): Promise<Resultado<typeof importadores.$inferSelect>> {
  try {
    const [fila] = await db.update(importadores).set(data).where(eq(importadores.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un importador con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteImportador(id: string): Promise<Resultado<true>> {
  const [{ value: ejecucionesCount }] = await db.select({ value: count() }).from(importadoresEjecuciones).where(eq(importadoresEjecuciones.idImportador, id));
  if (Number(ejecucionesCount) > 0) {
    return { error: `No se puede eliminar: hay ${ejecucionesCount} ejecución${Number(ejecucionesCount) !== 1 ? "es" : ""} registrada${Number(ejecucionesCount) !== 1 ? "s" : ""} para este importador.` };
  }

  await db.delete(importadores).where(eq(importadores.id, id));
  return { data: true };
}

// ---------- Registro de parsers (por extensión) y cargadores (por importador) ----------

/** Un parser toma los bytes crudos del archivo y devuelve filas de celdas — incluye la fila de encabezado si la hay, el cargador de cada importador decide qué hacer con ella. */
type ParserImportador = (buffer: Buffer) => Promise<string[][]>;
type CargadorImportador = (idEjecucion: string, filas: string[][]) => Promise<void>;

// En dev, Next.js puede reevaluar este módulo (hot-reload, o un chunk aparte
// para un Server Action) sin volver a correr instrumentation-node.ts — sin
// cachear en globalThis, esa reevaluación crea un Map nuevo y vacío, distinto
// del que registrarMotorImportacion()/registrarImportadorLegajosClientes()
// poblaron al bootear, y cargarArchivoWizard (llamado desde un Server Action)
// termina viendo "no hay parser registrado" aunque el arranque haya sido OK.
// Mismo patrón ya usado para el pool de Postgres, ver packages/db/src/client.ts.
declare global {
  var __valgianImportadoresParsers: Map<string, ParserImportador> | undefined;
  var __valgianImportadoresCargadores: Map<string, CargadorImportador> | undefined;
}

const parsers = globalThis.__valgianImportadoresParsers ?? new Map<string, ParserImportador>();
const cargadores = globalThis.__valgianImportadoresCargadores ?? new Map<string, CargadorImportador>();

if (process.env.NODE_ENV !== "production") {
  globalThis.__valgianImportadoresParsers = parsers;
  globalThis.__valgianImportadoresCargadores = cargadores;
}

/** Registro genérico en memoria, mismo patrón que registrarHandlerAccionExterna — nunca autodescubrimiento. */
export function registrarParserImportador(extension: string, parser: ParserImportador): void {
  parsers.set(extension.toLowerCase(), parser);
}

/** Vuelca las filas ya parseadas a la tabla de staging del importador — mapeo fijo, código propio de cada importador (ver Fase 3, domain/importadores.md). */
export function registrarCargadorImportador(codigoImportador: string, cargador: CargadorImportador): void {
  cargadores.set(codigoImportador, cargador);
}

/** Una columna del dominio de un importador — ENCABEZADO es lo que aparece en el archivo modelo/el encabezado real del archivo; CAMPO es la columna (camelCase) de su tabla de staging. */
export interface ColumnaImportador {
  encabezado: string;
  campo: string;
}

// Columnas de la forma mínima obligatoria de toda tabla de staging (ver
// domain/importadores.md) — nunca son "del dominio", se excluyen siempre de
// la plantilla derivada.
const COLUMNAS_BASE_STAGING = new Set(["ID", "ID_EJECUCION", "NRO_FILA", "ESTADO_VALIDACION", "MENSAJE_VALIDACION"]);

function columnaASnakeCase(nombreColumna: string): string {
  return nombreColumna
    .toLowerCase()
    .replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Deriva la plantilla de columnas de un importador AUTOMÁTICAMENTE desde el
 * schema real de su tabla de staging (`information_schema.columns`) — nunca
 * hay que mantener una lista aparte a mano: agregar una columna a la tabla de
 * staging ya alcanza para que el archivo modelo y la detección de encabezado
 * de `mapearFilasImportador` la reflejen. `CAMPO` se reconstruye mecánicamente
 * (SNAKE_CASE → camelCase) — confiable porque el proyecto entero sigue esa
 * misma convención de nombres (ver domain/core.md).
 */
export async function derivarPlantillaImportador(tablaStaging: string): Promise<ColumnaImportador[]> {
  if (!IDENTIFICADOR_SIMPLE.test(tablaStaging)) throw new Error(`Nombre de tabla de staging inválido: ${tablaStaging}`);

  const columnas = await queryClient<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${tablaStaging}
    ORDER BY ordinal_position
  `;

  return columnas
    .map((c) => c.column_name)
    .filter((nombre) => !COLUMNAS_BASE_STAGING.has(nombre))
    .map((nombre) => ({ encabezado: nombre.toLowerCase(), campo: columnaASnakeCase(nombre) }));
}

/** Resuelve el importador por ID y deriva su plantilla — usado por el endpoint de "Descargar archivo modelo" (ver apps/web/src/app/api/importadores/[id]/modelo/route.ts). */
export async function getColumnasModeloImportador(idImportador: string): Promise<Resultado<{ codigo: string; nombre: string; encabezados: string[] }>> {
  const [importador] = await db.select().from(importadores).where(eq(importadores.id, idImportador));
  if (!importador) return { error: "No existe ese importador." };

  const columnas = await derivarPlantillaImportador(importador.tablaStaging);
  if (columnas.length === 0) return { error: "No se pudo derivar el archivo modelo — revisá que la tabla de staging exista." };

  return { data: { codigo: importador.codigo, nombre: importador.nombre, encabezados: columnas.map((c) => c.encabezado) } };
}

export interface FilaMapeada {
  nroFila: number;
  campos: Record<string, string>;
}

/**
 * Helper genérico para que cada cargador mapee sus filas ya parseadas a los
 * CAMPO de su tabla de staging — reusable por cualquier importador estándar
 * (evita reescribir la misma lógica de detección de encabezado en cada uno).
 *
 * Detecta si la primera fila es un encabezado (matchea, case-insensitive, la
 * mitad o más de los ENCABEZADO declarados) o si el archivo viene sin
 * encabezado y esa fila YA es la primera fila de datos — en ese caso mapea
 * por POSICIÓN, en el mismo orden que declara la plantilla. Sin esto, un
 * archivo sin encabezado perdería su primera fila en silencio (se trataría
 * como si fuera el encabezado).
 */
export function mapearFilasImportador(filas: string[][], columnas: ColumnaImportador[]): FilaMapeada[] {
  if (filas.length === 0) return [];

  const encabezadosEsperados = columnas.map((c) => c.encabezado.toLowerCase());
  const primeraFilaNormalizada = filas[0].map((c) => c.trim().toLowerCase());
  const coincidencias = primeraFilaNormalizada.filter((c) => encabezadosEsperados.includes(c)).length;
  const pareceEncabezado = coincidencias >= Math.ceil(columnas.length / 2);

  const datos = pareceEncabezado ? filas.slice(1) : filas;
  const indicePorCampo: (string | null)[] = pareceEncabezado
    ? primeraFilaNormalizada.map((h) => columnas.find((c) => c.encabezado.toLowerCase() === h)?.campo ?? null)
    : columnas.map((c) => c.campo);

  return datos
    .map((fila, indice) => ({ fila, nroFila: indice + 1 }))
    .filter(({ fila }) => fila.some((celda) => celda.trim() !== ""))
    .map(({ fila, nroFila }) => {
      const campos: Record<string, string> = {};
      indicePorCampo.forEach((campo, i) => {
        if (campo) campos[campo] = (fila[i] ?? "").trim();
      });
      return { nroFila, campos };
    });
}

async function parseCsv(buffer: Buffer): Promise<string[][]> {
  return parseCsvSync(buffer, { relax_column_count: true, skip_empty_lines: true }) as string[][];
}

// .tsv y .txt se tratan como tab-delimited — convención más común para
// exports planos de sistemas legacy; si algún importador necesita otro
// delimitador para .txt, se resuelve registrando su propio parser para esa
// extensión con registrarParserImportador (pisa el default acá registrado).
async function parseTabDelimited(buffer: Buffer): Promise<string[][]> {
  return parseCsvSync(buffer, { delimiter: "\t", relax_column_count: true, skip_empty_lines: true }) as string[][];
}

async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const libro = XLSX.read(buffer, { type: "buffer" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1 });
  return filas.map((fila) => fila.map((celda) => (celda == null ? "" : String(celda))));
}

/** Llamado una vez desde apps/web/src/instrumentation-node.ts (registro explícito, ver docs/contracts/modulo.md). */
export function registrarMotorImportacion(): void {
  registrarParserImportador("csv", parseCsv);
  registrarParserImportador("tsv", parseTabDelimited);
  registrarParserImportador("txt", parseTabDelimited);
  registrarParserImportador("xlsx", parseXlsx);
  registrarHandlerAccionExterna("importacion", handlerImportacion);
}

// ---------- Búsqueda de archivo en directorio (modo automático) ----------

interface ArchivoEncontrado {
  nombre: string;
  rutaCompleta: string;
}

/** Siempre por fecha de modificación más antigua, alfabético como desempate — regla fija del motor, sin config (ver ADR 0021). */
async function buscarArchivo(rutaDirectorio: string, patron: string | null, extensiones: string[]): Promise<ArchivoEncontrado | null> {
  const dirAbsoluto = resolverRuta(rutaDirectorio);
  const nombres = await fs.readdir(dirAbsoluto);
  const regexPatron = patron ? likeToRegExp(patron) : null;

  const candidatos = nombres.filter((nombre) => {
    const ext = path.extname(nombre).slice(1).toLowerCase();
    if (!extensiones.includes(ext)) return false;
    if (regexPatron && !regexPatron.test(nombre)) return false;
    return true;
  });
  if (candidatos.length === 0) return null;

  const conStat = await Promise.all(
    candidatos.map(async (nombre) => {
      const rutaCompleta = path.join(dirAbsoluto, nombre);
      const stat = await fs.stat(rutaCompleta);
      return { nombre, rutaCompleta, mtime: stat.mtimeMs };
    }),
  );
  conStat.sort((a, b) => a.mtime - b.mtime || a.nombre.localeCompare(b.nombre));
  return conStat[0];
}

async function moverArchivoProcesado(rutaOrigen: string, carpetaDestino: string, nombreArchivo: string): Promise<void> {
  const dirDestino = resolverRuta(carpetaDestino);
  await fs.mkdir(dirDestino, { recursive: true });
  // fs.rename es atómico en POSIX y Windows — mismo criterio que archivos-adjuntos.ts.
  await fs.rename(rutaOrigen, path.join(dirDestino, nombreArchivo));
}

// ---------- Disparo automático (por PROCESO o por botón del ABM — mismo camino) ----------

/**
 * Mismo patrón que dispararProcesoManual (procesos.ts): valida el guard de
 * concurrencia (el índice único de IMPORTADORES_EJECUCIONES ya lo garantiza
 * a nivel de base, esto es para devolver un mensaje humano en vez de un error
 * de constraint crudo), crea la ejecución y encola en ACCIONES_EXTERNAS_COLA.
 * idUsuario es el logueado que clickeó el botón del ABM, o el usuario
 * "sistema" cuando lo dispara un PROCESO (ver seed.ts, ensureUsuarioSistema).
 */
export async function dispararImportadorAutomatico(idImportador: string, idUsuario: string): Promise<Resultado<true>> {
  const [importador] = await db.select().from(importadores).where(eq(importadores.id, idImportador));
  if (!importador) return { error: "No existe ese importador." };
  if (!importador.rutaDirectorio) return { error: "Este importador no tiene una ruta de directorio configurada — no se puede disparar en modo automático." };

  const [activa] = await db
    .select()
    .from(importadoresEjecuciones)
    .where(
      and(
        eq(importadoresEjecuciones.idImportador, idImportador),
        eq(importadoresEjecuciones.idUsuarioDisparo, idUsuario),
        notInArray(importadoresEjecuciones.estado, ["completado", "error", "cancelado"]),
      ),
    );
  if (activa) return { error: "Ya hay una importación de este importador en curso con tu usuario." };

  const [accion] = await db.select().from(accionesExternas).where(eq(accionesExternas.codigo, "importacion_generica"));
  if (!accion) return { error: "No está sembrada la acción externa \"importacion_generica\" — correr el seed del core." };

  let idEjecucion: string;
  try {
    const [creada] = await db
      .insert(importadoresEjecuciones)
      .values({ idImportador, idUsuarioDisparo: idUsuario, modoArchivo: "buscar_directorio", estado: "pendiente" })
      .returning();
    idEjecucion = creada.id;
  } catch (err) {
    if (esViolacionUnica(err)) return { error: "Ya hay una importación de este importador en curso con tu usuario." };
    throw err;
  }

  const { id: idCola } = await encolarAccionExterna({ idAccionExterna: accion.id, parametros: { idImportadorEjecucion: idEjecucion } });
  await db.update(importadoresEjecuciones).set({ idAccionExternaCola: idCola }).where(eq(importadoresEjecuciones.id, idEjecucion));

  return { data: true };
}

async function procesarEjecucionAutomatica(idEjecucion: string): Promise<void> {
  const [fila] = await db
    .select({ ejecucion: importadoresEjecuciones, importador: importadores })
    .from(importadoresEjecuciones)
    .innerJoin(importadores, eq(importadores.id, importadoresEjecuciones.idImportador))
    .where(eq(importadoresEjecuciones.id, idEjecucion));
  if (!fila) throw new Error(`No existe la ejecución de importador ${idEjecucion}.`);

  const { importador } = fila;
  if (!importador.rutaDirectorio) throw new Error("El importador no tiene RUTA_DIRECTORIO configurada.");

  const extensiones = importador.extensionesPermitidas
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const archivo = await buscarArchivo(importador.rutaDirectorio, importador.patronNombreArchivo, extensiones);

  if (!archivo) {
    // No es un error del sistema — es normal que un tick de PROCESO no
    // encuentre nada nuevo todavía. No se reintenta como fallo.
    await db
      .update(importadoresEjecuciones)
      .set({ estado: "cancelado", error: "No se encontró ningún archivo que matchee en el directorio configurado.", fechaFin: new Date() })
      .where(eq(importadoresEjecuciones.id, idEjecucion));
    return;
  }

  await db
    .update(importadoresEjecuciones)
    .set({ estado: "cargando", archivoNombre: archivo.nombre, fechaInicio: new Date() })
    .where(eq(importadoresEjecuciones.id, idEjecucion));

  const extension = path.extname(archivo.nombre).slice(1).toLowerCase();
  const parser = parsers.get(extension);
  if (!parser) throw new Error(`No hay parser registrado para la extensión "${extension}".`);
  const cargador = cargadores.get(importador.codigo);
  if (!cargador) throw new Error(`No hay cargador registrado para el importador "${importador.codigo}".`);

  const buffer = await fs.readFile(archivo.rutaCompleta);
  const filas = await parser(buffer);
  await cargador(idEjecucion, filas);

  await db.execute(sql`CALL sp_importar_ejecutar(${idEjecucion}, false)`);

  const [actualizada] = await db.select().from(importadoresEjecuciones).where(eq(importadoresEjecuciones.id, idEjecucion));
  if (actualizada?.estado === "error") {
    throw new Error(actualizada.error ?? "La importación terminó en error.");
  }
  if (actualizada?.estado === "completado" && importador.carpetaDestinoProcesados) {
    await moverArchivoProcesado(archivo.rutaCompleta, importador.carpetaDestinoProcesados, archivo.nombre);
  }
}

async function handlerImportacion(fila: FilaAccionExternaCola): Promise<void> {
  const inicio = Date.now();
  const parametros = fila.parametros as { idImportadorEjecucion?: string } | null;
  const idEjecucion = parametros?.idImportadorEjecucion;
  if (!idEjecucion) {
    await finalizarIntentoAccionExterna(fila.id, { resultado: 1, resultadoDesc: "Falta idImportadorEjecucion en PARAMETROS." });
    return;
  }

  try {
    await procesarEjecucionAutomatica(idEjecucion);
    await finalizarIntentoAccionExterna(fila.id, { resultado: 0, tiempoConexionMs: Date.now() - inicio });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(importadoresEjecuciones)
      .set({ estado: "error", error: message, fechaFin: new Date() })
      .where(eq(importadoresEjecuciones.id, idEjecucion));
    await finalizarIntentoAccionExterna(fila.id, { resultado: 1, resultadoDesc: message, tiempoConexionMs: Date.now() - inicio });
  }
}

// ---------- Soporte para el wizard — el archivo ya está en Node (upload), no pasa por la cola ----------

const PAGE_SIZE_VALIDACION = 20;

export interface ImportadorParaWizard {
  id: string;
  codigo: string;
  nombre: string;
  extensionesPermitidas: string;
}

/** Solo lo que necesita el combo del wizard — no expone TABLA_STAGING/SP_NOMBRE (detalle de implementación interno) al cliente. */
export async function listImportadoresParaWizard(): Promise<ImportadorParaWizard[]> {
  return db
    .select({ id: importadores.id, codigo: importadores.codigo, nombre: importadores.nombre, extensionesPermitidas: importadores.extensionesPermitidas })
    .from(importadores)
    .where(eq(importadores.activo, true))
    .orderBy(importadores.nombre);
}

export interface EjecucionImportadorEstado {
  id: string;
  estado: string;
  archivoNombre: string | null;
  resumenValidacion: unknown;
  resumenImpacto: unknown;
  error: string | null;
}

export async function getEjecucionImportador(idEjecucion: string): Promise<Resultado<EjecucionImportadorEstado>> {
  const [fila] = await db
    .select({
      id: importadoresEjecuciones.id,
      estado: importadoresEjecuciones.estado,
      archivoNombre: importadoresEjecuciones.archivoNombre,
      resumenValidacion: importadoresEjecuciones.resumenValidacion,
      resumenImpacto: importadoresEjecuciones.resumenImpacto,
      error: importadoresEjecuciones.error,
    })
    .from(importadoresEjecuciones)
    .where(eq(importadoresEjecuciones.id, idEjecucion));
  if (!fila) return { error: "No existe esa ejecución." };
  return { data: fila };
}

export interface ResultadosValidacion {
  columnas: string[];
  filas: Record<string, unknown>[];
  total: number;
  pagina: number;
  hayMas: boolean;
}

/**
 * Introspección genérica de una tabla de staging/histórico vía
 * information_schema — ni el wizard ni el reporte de auditoría conocen de
 * antemano el schema de cada importador (mapeo fijo, definido por cada
 * importador), así que arman la tabla de resultados dinámicamente en vez de
 * necesitar código de UI específico por importador. `tabla` se valida contra
 * IDENTIFICADOR_SIMPLE antes de interpolarla (mismo criterio que
 * sp_importar_ejecutar); los nombres de columna vienen de information_schema
 * (catálogo real de Postgres), no de input arbitrario. Compartido entre
 * getResultadosValidacion (wizard, siempre TABLA_STAGING) y
 * getDetalleEjecucionImportador (reporte de auditoría, TABLA_STAGING o
 * TABLA_HISTORICO según el estado — ver ahí).
 */
async function consultarFilasEjecucion(tabla: string, idEjecucion: string, pagina: number): Promise<Resultado<ResultadosValidacion>> {
  if (!IDENTIFICADOR_SIMPLE.test(tabla)) return { error: "Nombre de tabla inválido." };

  const columnasInfo = await queryClient<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = ${tabla} AND column_name NOT IN ('ID', 'ID_EJECUCION')
    ORDER BY ordinal_position
  `;
  const columnas = columnasInfo.map((c) => c.column_name);
  if (columnas.length === 0) return { error: `La tabla "${tabla}" no existe o no tiene columnas propias.` };

  const [{ c: total }] = await queryClient.unsafe<{ c: number }[]>(`SELECT count(*)::int AS c FROM "${tabla}" WHERE "ID_EJECUCION" = $1`, [idEjecucion]);

  const columnasSql = columnas.map((c) => `"${c}"`).join(", ");
  const filasRaw = await queryClient.unsafe<Record<string, unknown>[]>(
    `SELECT ${columnasSql} FROM "${tabla}" WHERE "ID_EJECUCION" = $1 ORDER BY "NRO_FILA" LIMIT $2 OFFSET $3`,
    [idEjecucion, PAGE_SIZE_VALIDACION + 1, pagina * PAGE_SIZE_VALIDACION],
  );
  const hayMas = filasRaw.length > PAGE_SIZE_VALIDACION;
  const filas = hayMas ? filasRaw.slice(0, PAGE_SIZE_VALIDACION) : filasRaw;

  return { data: { columnas, filas, total, pagina, hayMas } };
}

export async function getResultadosValidacion(idEjecucion: string, pagina = 0): Promise<Resultado<ResultadosValidacion>> {
  const [fila] = await db
    .select({ tablaStaging: importadores.tablaStaging })
    .from(importadoresEjecuciones)
    .innerJoin(importadores, eq(importadores.id, importadoresEjecuciones.idImportador))
    .where(eq(importadoresEjecuciones.id, idEjecucion));
  if (!fila) return { error: "No existe esa ejecución." };
  return consultarFilasEjecucion(fila.tablaStaging, idEjecucion, pagina);
}

/**
 * Nivel 2 del reporte de auditoría "Importaciones" — mismo mecanismo de
 * introspección que getResultadosValidacion, pero elige la tabla según el
 * estado de la ejecución en vez de asumir siempre TABLA_STAGING: una vez
 * 'completado', sp_importar_ejecutar SIEMPRE borra el staging (con o sin
 * histórico configurado, ver domain/importadores.md) y movió las filas a
 * TABLA_HISTORICO si estaba seteada — cualquier otro estado (en curso, error,
 * cancelada) todavía tiene sus filas en TABLA_STAGING, nunca las llegó a mover.
 * Reusable para CUALQUIER importador nuevo sin código de UI/backend por caso
 * (ni un dialog ni una query a mano) — ver docs/domain/reportes.md.
 */
export async function getDetalleEjecucionImportador(idEjecucion: string, pagina = 0): Promise<Resultado<ResultadosValidacion>> {
  const [fila] = await db
    .select({ estado: importadoresEjecuciones.estado, tablaStaging: importadores.tablaStaging, tablaHistorico: importadores.tablaHistorico })
    .from(importadoresEjecuciones)
    .innerJoin(importadores, eq(importadores.id, importadoresEjecuciones.idImportador))
    .where(eq(importadoresEjecuciones.id, idEjecucion));
  if (!fila) return { error: "No existe esa ejecución." };

  if (fila.estado === "completado") {
    if (!fila.tablaHistorico) return { error: "Este importador no guarda histórico — no hay detalle disponible para ejecuciones completadas." };
    return consultarFilasEjecucion(fila.tablaHistorico, idEjecucion, pagina);
  }
  return consultarFilasEjecucion(fila.tablaStaging, idEjecucion, pagina);
}

export async function cargarArchivoWizard(idImportador: string, idUsuario: string, buffer: Buffer, nombreArchivo: string): Promise<Resultado<{ idEjecucion: string }>> {
  const [importador] = await db.select().from(importadores).where(eq(importadores.id, idImportador));
  if (!importador) return { error: "No existe ese importador." };

  const extension = path.extname(nombreArchivo).slice(1).toLowerCase();
  const extensiones = importador.extensionesPermitidas.split(",").map((e) => e.trim().toLowerCase());
  if (!extensiones.includes(extension)) return { error: `Este importador no acepta archivos ".${extension}".` };

  const parser = parsers.get(extension);
  if (!parser) return { error: `No hay parser registrado para la extensión "${extension}".` };
  const cargador = cargadores.get(importador.codigo);
  if (!cargador) return { error: `No hay cargador registrado para el importador "${importador.codigo}".` };

  // El wizard no tiene forma de "retomar" una ejecución en curso al recargar
  // la página (es puro estado de React, sin persistir el idEjecucion) — así
  // que cualquier ejecución activa de ESTE usuario para ESTE importador que
  // siga viva acá es necesariamente basura de una sesión anterior abandonada
  // sin tocar "Cancelar" (cerró la pestaña, recargó, etc.), nunca un wizard
  // legítimamente en curso en otra pestaña. Se cancela sola para que la nueva
  // carga pueda seguir, en vez de bloquear con el guard de concurrencia.
  // NO se aplica al disparo automático (dispararImportadorAutomatico): ahí sí
  // puede haber una corrida real en curso vía la cola, cancelarla de prepo
  // sería peligroso.
  await db
    .update(importadoresEjecuciones)
    .set({ estado: "cancelado", fechaFin: new Date() })
    .where(
      and(
        eq(importadoresEjecuciones.idImportador, idImportador),
        eq(importadoresEjecuciones.idUsuarioDisparo, idUsuario),
        inArray(importadoresEjecuciones.estado, ESTADOS_EJECUCION_ACTIVOS),
      ),
    );

  let idEjecucion: string;
  try {
    const [creada] = await db
      .insert(importadoresEjecuciones)
      .values({
        idImportador,
        idUsuarioDisparo: idUsuario,
        modoArchivo: "subido_manual",
        archivoNombre: nombreArchivo,
        estado: "cargando",
        fechaInicio: new Date(),
      })
      .returning();
    idEjecucion = creada.id;
  } catch (err) {
    if (esViolacionUnica(err)) return { error: "Ya tenés una importación de este importador en curso." };
    throw err;
  }

  const filas = await parser(buffer);
  await cargador(idEjecucion, filas);
  await db.execute(sql`CALL sp_importar_ejecutar(${idEjecucion}, true)`);

  return { data: { idEjecucion } };
}

/** El usuario ya vio los resultados de validación y confirmó — sigue con impactar/histórico/limpieza. */
export async function confirmarImportacionWizard(idEjecucion: string): Promise<Resultado<true>> {
  await db.execute(sql`CALL sp_importar_ejecutar(${idEjecucion}, false)`);
  return { data: true };
}

/** El usuario abandona el wizard antes de confirmar — sin esto, la ejecución queda en 'esperando_confirmacion' para siempre y bloquea (guard de concurrencia) una corrida nueva del mismo importador con su usuario. */
export async function cancelarImportacionWizard(idEjecucion: string): Promise<Resultado<true>> {
  await db
    .update(importadoresEjecuciones)
    .set({ estado: "cancelado", fechaFin: new Date() })
    .where(and(eq(importadoresEjecuciones.id, idEjecucion), eq(importadoresEjecuciones.estado, "esperando_confirmacion")));
  return { data: true };
}
