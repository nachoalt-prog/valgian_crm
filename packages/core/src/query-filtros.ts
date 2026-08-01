import { sql } from "drizzle-orm";
import { db } from "@valgian/db";

/**
 * Motor compartido de query-filtros — extraído de bandejas.ts (ver ADR 0014)
 * para que Bandejas y Reportes reusen la misma lógica de armado de WHERE +
 * bind seguro de valores, en vez de duplicarla.
 *
 * La query base (BANDEJAS.QUERY / REPORTES.QUERY) es SQL de confianza
 * (autorado por un developer, ver ADR 0009). Los valores que tipea el
 * usuario en el formulario de filtros SIEMPRE se pasan parametrizados —
 * nunca interpolación de string.
 */

const IDENTIFICADOR_VALIDO = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// No exportada — motor-estados.ts ya expone su propia validarIdentificador
// (mismo patrón, dominio distinto); evitamos el choque de nombres en el
// barrel de packages/core sin duplicar innecesariamente la lógica pública.
function validarIdentificador(campo: string): void {
  if (!IDENTIFICADOR_VALIDO.test(campo)) {
    throw new Error(`Campo de filtro inválido: "${campo}".`);
  }
}

export interface FiltroAplicable {
  campo: string | null;
  tipo: string | null;
}

/**
 * `valores` es un mapa plano de los inputs del formulario: para filtros
 * simples, la key es el CAMPO tal cual; para 'fecha_rango', son `${campo}Desde`
 * y `${campo}Hasta`.
 */
function armarCondiciones(filtrosRows: FiltroAplicable[], valores: Record<string, string>) {
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
  return condiciones;
}

export interface EjecutarQueryConFiltrosOpciones {
  /** Reportes siempre pagina (volumen de análisis); Bandejas no pasa esto — mismo comportamiento de siempre. */
  limit?: number;
  offset?: number;
}

export async function ejecutarQueryConFiltros(
  queryBase: string,
  filtrosRows: FiltroAplicable[],
  valores: Record<string, string>,
  opciones?: EjecutarQueryConFiltrosOpciones,
): Promise<Record<string, unknown>[]> {
  const condiciones = armarCondiciones(filtrosRows, valores);
  const whereClause = condiciones.length > 0 ? sql.join(condiciones, sql` AND `) : sql`true`;

  let query = sql`SELECT * FROM (${sql.raw(queryBase)}) AS q WHERE ${whereClause}`;
  if (opciones?.limit !== undefined) query = sql`${query} LIMIT ${opciones.limit}`;
  if (opciones?.offset !== undefined) query = sql`${query} OFFSET ${opciones.offset}`;

  return db.execute<Record<string, unknown>>(query);
}
