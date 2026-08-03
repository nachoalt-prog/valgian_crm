import { eq, count, sql } from "drizzle-orm";
import { db, categoriasTiposTramite, tiposTramite, tiposTramiteCampos, tiposCampos } from "@valgian/db";

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

export async function getTipoTramite(id: string) {
  const [fila] = await db.select().from(tiposTramite).where(eq(tiposTramite.id, id));
  return fila ?? null;
}

export interface TipoTramiteCampoConTipo {
  id: string;
  codigo: string;
  nombre: string;
  tipoCampoCodigo: string | null;
  orden: number | null;
  obligatorio: boolean | null;
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
  return db
    .select({
      id: tiposTramiteCampos.id,
      codigo: tiposTramiteCampos.codigo,
      nombre: tiposTramiteCampos.nombre,
      tipoCampoCodigo: tiposCampos.codigo,
      orden: tiposTramiteCampos.orden,
      obligatorio: tiposTramiteCampos.obligatorio,
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
