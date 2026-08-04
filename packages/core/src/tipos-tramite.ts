import { eq, inArray, count, sql } from "drizzle-orm";
import {
  db,
  categoriasTiposTramite,
  tiposTramite,
  tiposTramiteCampos,
  tiposTramiteCamposObligatorios,
  tiposCampos,
  tramitesCamposDatos,
  tramites,
} from "@valgian/db";

/** Catálogos de configuración de trámites — CATEGORIAS_TIPOS_TRAMITE, TIPOS_TRAMITE, TIPOS_TRAMITE_CAMPOS. */

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

const PREFIJO_REGEX = /^[A-Z]{1,3}$/;

export async function listCategoriasTiposTramite() {
  return db.select().from(categoriasTiposTramite).orderBy(categoriasTiposTramite.nombre);
}

/** Catálogo fijo de TIPOS_CAMPOS (INPUT_TEXT, SELECT, etc.) — para el selector de "tipo de campo" del ABM de TIPOS_TRAMITE_CAMPOS. */
export async function listTiposCampos() {
  return db.select().from(tiposCampos).orderBy(tiposCampos.nombre);
}

export interface CategoriaTipoTramiteInput {
  codigo: string;
  nombre: string;
  prefijo: string;
}

function validarPrefijo(prefijo: string): string | null {
  return PREFIJO_REGEX.test(prefijo) ? null : "El prefijo tiene que ser de 1 a 3 letras mayúsculas.";
}

/** ABM de CATEGORIAS_TIPOS_TRAMITE — antepone el PREFIJO a TRAMITES.NUMERO (ver domain/tramites.md). */
export async function crearCategoriaTipoTramite(data: CategoriaTipoTramiteInput): Promise<Resultado<typeof categoriasTiposTramite.$inferSelect>> {
  const errorPrefijo = validarPrefijo(data.prefijo);
  if (errorPrefijo) return { error: errorPrefijo };

  try {
    const [fila] = await db.insert(categoriasTiposTramite).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una categoría con el código o el prefijo "${data.codigo}"/"${data.prefijo}".` };
    throw err;
  }
}

export async function actualizarCategoriaTipoTramite(
  id: string,
  data: CategoriaTipoTramiteInput,
): Promise<Resultado<typeof categoriasTiposTramite.$inferSelect>> {
  const errorPrefijo = validarPrefijo(data.prefijo);
  if (errorPrefijo) return { error: errorPrefijo };

  try {
    const [fila] = await db.update(categoriasTiposTramite).set(data).where(eq(categoriasTiposTramite.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una categoría con el código o el prefijo "${data.codigo}"/"${data.prefijo}".` };
    throw err;
  }
}

export async function borrarCategoriaTipoTramite(id: string): Promise<Resultado<true>> {
  const [{ value: tiposCount }] = await db.select({ value: count() }).from(tiposTramite).where(eq(tiposTramite.idCategoria, id));
  if (Number(tiposCount) > 0) {
    return { error: `No se puede eliminar: hay ${tiposCount} tipo${Number(tiposCount) !== 1 ? "s" : ""} de trámite en esta categoría.` };
  }

  await db.delete(categoriasTiposTramite).where(eq(categoriasTiposTramite.id, id));
  return { data: true };
}

export interface TipoTramiteResumen {
  id: string;
  codigo: string;
  nombre: string;
  idCategoria: string | null;
}

export async function listTiposTramitePorCategoria(idCategoria: string): Promise<TipoTramiteResumen[]> {
  return db
    .select({ id: tiposTramite.id, codigo: tiposTramite.codigo, nombre: tiposTramite.nombre, idCategoria: tiposTramite.idCategoria })
    .from(tiposTramite)
    .where(eq(tiposTramite.idCategoria, idCategoria))
    .orderBy(tiposTramite.nombre);
}

/** Todos los tipos de trámite, sin filtrar por categoría — para el desplegable del filtro del listado. */
export async function listTodosTiposTramite(): Promise<TipoTramiteResumen[]> {
  return db
    .select({ id: tiposTramite.id, codigo: tiposTramite.codigo, nombre: tiposTramite.nombre, idCategoria: tiposTramite.idCategoria })
    .from(tiposTramite)
    .orderBy(tiposTramite.nombre);
}

/** Todos los TIPOS_TRAMITE con sus columnas completas — para el ABM (a diferencia de listTodosTiposTramite/listTiposTramitePorCategoria, que son un resumen para el selector del lanzador de trámites). */
export async function listTiposTramiteAdmin() {
  return db.select().from(tiposTramite).orderBy(tiposTramite.nombre);
}

export async function getTipoTramite(id: string) {
  const [fila] = await db.select().from(tiposTramite).where(eq(tiposTramite.id, id));
  return fila ?? null;
}

export interface TipoTramiteInput {
  codigo: string;
  nombre: string;
  idCategoria: string | null;
  idEstrategia: string | null;
  idEntidad: string | null;
  filtro: string | null;
  componente: string | null;
}

/** ABM de TIPOS_TRAMITE — el tipo fija con qué ENTIDAD/ESTRATEGIA se gestiona cada trámite (ver domain/tramites.md). */
export async function crearTipoTramite(data: TipoTramiteInput): Promise<Resultado<typeof tiposTramite.$inferSelect>> {
  try {
    const [fila] = await db.insert(tiposTramite).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un tipo de trámite con el código "${data.codigo}".` };
    throw err;
  }
}

export async function actualizarTipoTramite(id: string, data: TipoTramiteInput): Promise<Resultado<typeof tiposTramite.$inferSelect>> {
  try {
    const [fila] = await db.update(tiposTramite).set(data).where(eq(tiposTramite.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un tipo de trámite con el código "${data.codigo}".` };
    throw err;
  }
}

/** Borra un TIPOS_TRAMITE — bloquea si tiene trámites; si no, cascadea sus campos (y la obligatoriedad de esos campos). */
export async function borrarTipoTramite(id: string): Promise<Resultado<true>> {
  const [{ value: tramitesCount }] = await db.select({ value: count() }).from(tramites).where(eq(tramites.idTipoTramite, id));
  if (Number(tramitesCount) > 0) {
    return { error: `No se puede eliminar: hay ${tramitesCount} trámite${Number(tramitesCount) !== 1 ? "s" : ""} de este tipo.` };
  }

  const campos = await db.select({ id: tiposTramiteCampos.id }).from(tiposTramiteCampos).where(eq(tiposTramiteCampos.idTipoTramite, id));
  const idsCampos = campos.map((c) => c.id);
  if (idsCampos.length > 0) {
    await db.delete(tiposTramiteCamposObligatorios).where(inArray(tiposTramiteCamposObligatorios.idTipoTramiteCampo, idsCampos));
    await db.delete(tiposTramiteCampos).where(inArray(tiposTramiteCampos.id, idsCampos));
  }
  await db.delete(tiposTramite).where(eq(tiposTramite.id, id));
  return { data: true };
}

export interface TipoTramiteCampoConTipo {
  id: string;
  codigo: string;
  nombre: string;
  idTipoCampo: string | null;
  tipoCampoCodigo: string | null;
  orden: number | null;
  obligatorioEnEstados: string[];
  visible: boolean | null;
  editable: boolean | null;
  longitudMax: number | null;
  numMin: number | null;
  numMax: number | null;
  numStep: number | null;
  radioGroup: number | null;
  placeholder: string | null;
  ayuda: string | null;
  mascara: string | null;
  regex: string | null;
  listaValores: string | null;
}

/** Campos configurados para un tipo de trámite, en el orden en que se dibujan. */
export async function listTiposTramiteCampos(idTipoTramite: string): Promise<TipoTramiteCampoConTipo[]> {
  const filas = await db
    .select({
      id: tiposTramiteCampos.id,
      codigo: tiposTramiteCampos.codigo,
      nombre: tiposTramiteCampos.nombre,
      idTipoCampo: tiposTramiteCampos.idTipoCampo,
      tipoCampoCodigo: tiposCampos.codigo,
      orden: tiposTramiteCampos.orden,
      visible: tiposTramiteCampos.visible,
      editable: tiposTramiteCampos.editable,
      longitudMax: tiposTramiteCampos.longitudMax,
      numMin: tiposTramiteCampos.numMin,
      numMax: tiposTramiteCampos.numMax,
      numStep: tiposTramiteCampos.numStep,
      radioGroup: tiposTramiteCampos.radioGroup,
      placeholder: tiposTramiteCampos.placeholder,
      ayuda: tiposTramiteCampos.ayuda,
      mascara: tiposTramiteCampos.mascara,
      regex: tiposTramiteCampos.regex,
      listaValores: tiposTramiteCampos.listaValores,
    })
    .from(tiposTramiteCampos)
    .leftJoin(tiposCampos, eq(tiposCampos.id, tiposTramiteCampos.idTipoCampo))
    .where(eq(tiposTramiteCampos.idTipoTramite, idTipoTramite))
    .orderBy(tiposTramiteCampos.orden);

  if (filas.length === 0) return [];

  const obligatorios = await db
    .select({ idTipoTramiteCampo: tiposTramiteCamposObligatorios.idTipoTramiteCampo, idEstado: tiposTramiteCamposObligatorios.idEstado })
    .from(tiposTramiteCamposObligatorios)
    .where(
      inArray(
        tiposTramiteCamposObligatorios.idTipoTramiteCampo,
        filas.map((f) => f.id),
      ),
    );
  const estadosPorCampo = new Map<string, string[]>();
  for (const o of obligatorios) {
    if (!o.idTipoTramiteCampo || !o.idEstado) continue;
    const lista = estadosPorCampo.get(o.idTipoTramiteCampo) ?? [];
    lista.push(o.idEstado);
    estadosPorCampo.set(o.idTipoTramiteCampo, lista);
  }

  return filas.map((f) => ({ ...f, obligatorioEnEstados: estadosPorCampo.get(f.id) ?? [] }));
}

export interface TipoTramiteCampoInput {
  codigo: string;
  nombre: string;
  idTipoCampo: string | null;
  orden: number | null;
  visible: boolean;
  editable: boolean;
  longitudMax: number | null;
  numMin: number | null;
  numMax: number | null;
  numStep: number | null;
  radioGroup: number | null;
  placeholder: string | null;
  ayuda: string | null;
  regex: string | null;
  listaValores: string | null;
  obligatorioEnEstados: string[];
}

async function sincronizarObligatoriedad(idTipoTramiteCampo: string, obligatorioEnEstados: string[]): Promise<void> {
  await db.delete(tiposTramiteCamposObligatorios).where(eq(tiposTramiteCamposObligatorios.idTipoTramiteCampo, idTipoTramiteCampo));
  if (obligatorioEnEstados.length > 0) {
    await db.insert(tiposTramiteCamposObligatorios).values(obligatorioEnEstados.map((idEstado) => ({ idTipoTramiteCampo, idEstado })));
  }
}

/** ABM de TIPOS_TRAMITE_CAMPOS — dibuja el formulario autogenerado del Modal de Trámites (ver domain/tramites.md). */
export async function crearTipoTramiteCampo(idTipoTramite: string, data: TipoTramiteCampoInput): Promise<Resultado<{ id: string }>> {
  const { obligatorioEnEstados, ...columnas } = data;
  try {
    const [fila] = await db
      .insert(tiposTramiteCampos)
      .values({ ...columnas, idTipoTramite })
      .returning({ id: tiposTramiteCampos.id });
    await sincronizarObligatoriedad(fila.id, obligatorioEnEstados);
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un campo con el código "${data.codigo}" en este tipo de trámite.` };
    throw err;
  }
}

export async function actualizarTipoTramiteCampo(id: string, data: TipoTramiteCampoInput): Promise<Resultado<{ id: string }>> {
  const { obligatorioEnEstados, ...columnas } = data;
  try {
    await db.update(tiposTramiteCampos).set(columnas).where(eq(tiposTramiteCampos.id, id));
    await sincronizarObligatoriedad(id, obligatorioEnEstados);
    return { data: { id } };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un campo con el código "${data.codigo}" en este tipo de trámite.` };
    throw err;
  }
}

/** Bloquea el borrado si el campo ya tiene datos cargados en algún trámite. */
export async function borrarTipoTramiteCampo(id: string): Promise<Resultado<true>> {
  const [{ value: datosCount }] = await db.select({ value: count() }).from(tramitesCamposDatos).where(eq(tramitesCamposDatos.idTipoTramiteCampo, id));
  if (Number(datosCount) > 0) {
    return { error: `No se puede eliminar: ${datosCount} trámite${Number(datosCount) !== 1 ? "s" : ""} ya tienen datos cargados en este campo.` };
  }

  await db.delete(tiposTramiteCamposObligatorios).where(eq(tiposTramiteCamposObligatorios.idTipoTramiteCampo, id));
  await db.delete(tiposTramiteCampos).where(eq(tiposTramiteCampos.id, id));
  return { data: true };
}

export interface OpcionListaValores {
  value: string;
  label: string;
}

/** Ejecuta TIPOS_TRAMITE_CAMPOS.LISTA_VALORES — SQL de confianza (ADR 0009), mismo criterio que FILTROS.QUERY. */
export async function ejecutarListaValores(query: string): Promise<OpcionListaValores[]> {
  const filas = await db.execute<{ value: string; label: string }>(sql.raw(query));
  return filas.map((r) => ({ value: String(r.value), label: String(r.label) }));
}
