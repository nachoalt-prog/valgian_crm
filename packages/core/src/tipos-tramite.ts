import { eq, sql } from "drizzle-orm";
import { db, categoriasTiposTramite, tiposTramite, tiposTramiteCampos, tiposCampos } from "@valgian/db";

/** Catálogos de configuración de trámites — CATEGORIAS_TIPOS_TRAMITE, TIPOS_TRAMITE, TIPOS_TRAMITE_CAMPOS. */

export async function listCategoriasTiposTramite() {
  return db.select().from(categoriasTiposTramite).orderBy(categoriasTiposTramite.nombre);
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
