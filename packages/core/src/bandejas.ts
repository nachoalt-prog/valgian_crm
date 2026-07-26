import { eq, sql } from "drizzle-orm";
import { db, bandejas, bandejasFiltros, bandejasPerfiles, filtros } from "@valgian/db";

/**
 * Capa de ejecución de Bandejas — ver domain/bandejas.md.
 *
 * BANDEJAS.QUERY y FILTROS.QUERY son SQL de confianza (autorado vía seed, no
 * por el usuario final — mismo nivel que ACCIONES.COMANDO, ver ADR 0009). Los
 * valores que ingresa el usuario en el formulario de búsqueda SIEMPRE se
 * pasan parametrizados (nunca interpolados como string) — ver buscarBandeja.
 */

const IDENTIFICADOR_VALIDO = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validarIdentificador(campo: string): void {
  if (!IDENTIFICADOR_VALIDO.test(campo)) {
    throw new Error(`Campo de filtro inválido: "${campo}".`);
  }
}

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

  const condiciones = [];
  for (const f of filtrosRows) {
    const campo = f.campo;
    if (!campo) continue;
    validarIdentificador(campo);
    const columna = sql.raw(`"${campo}"`);

    if (f.tipo === "fecha_rango") {
      const desde = valores[`${campo}Desde`];
      const hasta = valores[`${campo}Hasta`];
      if (desde) condiciones.push(sql`${columna} >= ${desde}`);
      if (hasta) condiciones.push(sql`${columna} <= ${hasta}`);
      continue;
    }

    const valor = valores[campo];
    if (!valor) continue;

    if (f.tipo === "texto_like") {
      condiciones.push(sql`${columna} ILIKE ${"%" + valor + "%"}`);
    } else if (f.tipo === "select" || f.tipo === "fecha") {
      condiciones.push(sql`${columna} = ${valor}`);
    }
  }

  const whereClause = condiciones.length > 0 ? sql.join(condiciones, sql` AND `) : sql`true`;
  const query = sql`SELECT * FROM (${sql.raw(bandeja.query)}) AS b WHERE ${whereClause}`;

  return db.execute<Record<string, unknown>>(query);
}
