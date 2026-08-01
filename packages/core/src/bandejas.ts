import { eq, sql } from "drizzle-orm";
import { db, bandejas, bandejasFiltros, bandejasPerfiles, filtros } from "@valgian/db";
import { ejecutarQueryConFiltros } from "./query-filtros";

/**
 * Capa de ejecución de Bandejas — ver domain/bandejas.md.
 *
 * BANDEJAS.QUERY y FILTROS.QUERY son SQL de confianza (autorado vía seed, no
 * por el usuario final — mismo nivel que ACCIONES.COMANDO, ver ADR 0009). Los
 * valores que ingresa el usuario en el formulario de búsqueda SIEMPRE se
 * pasan parametrizados (nunca interpolados como string) — ver buscarBandeja.
 *
 * El armado de WHERE + bind seguro vive en ./query-filtros (compartido con
 * Reportes, ver ADR 0014) — acá solo queda la resolución de config/filtros
 * propia de Bandejas.
 */

export interface BandejaResumen {
  id: string;
  codigo: string;
  nombre: string;
}

export async function listBandejasParaPerfil(perfilId: string): Promise<BandejaResumen[]> {
  return db
    .select({ id: bandejas.id, codigo: bandejas.codigo, nombre: bandejas.nombre })
    .from(bandejasPerfiles)
    .innerJoin(bandejas, eq(bandejas.id, bandejasPerfiles.idBandeja))
    .where(eq(bandejasPerfiles.idPerfil, perfilId))
    .orderBy(bandejas.nombre);
}

export interface ColumnaBandeja {
  campo: string;
  label: string;
  tipo?: string;
}

export interface OpcionFiltro {
  value: string;
  label: string;
}

export interface FiltroBandeja {
  campo: string;
  nombre: string;
  tipo: string;
  orden: number;
  opciones?: OpcionFiltro[];
}

export interface BandejaConfig {
  id: string;
  codigo: string;
  nombre: string;
  columnas: ColumnaBandeja[];
  filtros: FiltroBandeja[];
  // 'legajo' (o null, default histórico) abre LegajoLayoutModal; 'tramite' abre
  // el modal de trámites directo — ver domain/tramites.md.
  tipoApertura: string | null;
}

export async function getBandejaConfig(bandejaId: string): Promise<BandejaConfig> {
  const [bandeja] = await db.select().from(bandejas).where(eq(bandejas.id, bandejaId));
  if (!bandeja) throw new Error(`No existe la bandeja "${bandejaId}".`);

  const filtrosRows = await db
    .select({
      campo: bandejasFiltros.campo,
      orden: bandejasFiltros.orden,
      nombre: filtros.nombre,
      tipo: filtros.tipo,
      query: filtros.query,
    })
    .from(bandejasFiltros)
    .innerJoin(filtros, eq(filtros.id, bandejasFiltros.idFiltro))
    .where(eq(bandejasFiltros.idBandeja, bandejaId))
    .orderBy(bandejasFiltros.orden);

  const filtrosConOpciones: FiltroBandeja[] = await Promise.all(
    filtrosRows.map(async (f) => {
      let opciones: OpcionFiltro[] | undefined;
      if (f.tipo === "select" && f.query) {
        const filas = await db.execute<{ value: string; label: string }>(sql.raw(f.query));
        opciones = filas.map((r) => ({ value: String(r.value), label: String(r.label) }));
      }
      return {
        campo: f.campo ?? "",
        nombre: f.nombre,
        tipo: f.tipo ?? "texto_like",
        orden: f.orden ?? 0,
        opciones,
      };
    }),
  );

  return {
    id: bandeja.id,
    codigo: bandeja.codigo,
    nombre: bandeja.nombre,
    columnas: (bandeja.columnas as ColumnaBandeja[] | null) ?? [],
    filtros: filtrosConOpciones,
    tipoApertura: bandeja.tipoApertura,
  };
}

/**
 * `valores` es un mapa plano de los inputs del formulario: para filtros
 * simples, la key es el CAMPO tal cual; para 'fecha_rango', son `${campo}Desde`
 * y `${campo}Hasta` (mismo criterio que el mock de V0 para daterange).
 */
export async function buscarBandeja(bandejaId: string, valores: Record<string, string>): Promise<Record<string, unknown>[]> {
  const [bandeja] = await db.select().from(bandejas).where(eq(bandejas.id, bandejaId));
  if (!bandeja?.query) throw new Error(`La bandeja "${bandejaId}" no tiene QUERY configurado.`);

  const filtrosRows = await db
    .select({ campo: bandejasFiltros.campo, tipo: filtros.tipo })
    .from(bandejasFiltros)
    .innerJoin(filtros, eq(filtros.id, bandejasFiltros.idFiltro))
    .where(eq(bandejasFiltros.idBandeja, bandejaId));

  // Sin límite/offset — mismo comportamiento de siempre (ver ADR 0014, Reportes sí pagina).
  return ejecutarQueryConFiltros(bandeja.query, filtrosRows, valores);
}
