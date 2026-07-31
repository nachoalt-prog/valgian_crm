import { eq, inArray } from "drizzle-orm";
import { db, queryClient, placeholders } from "@valgian/db";

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function listPlaceholders() {
  return db.select().from(placeholders).orderBy(placeholders.nombre);
}

export interface PlaceholderInput {
  codigo: string;
  nombre: string;
  query: string | null;
  escapar: boolean;
}

export async function createPlaceholder(data: PlaceholderInput): Promise<Resultado<typeof placeholders.$inferSelect>> {
  try {
    const [fila] = await db.insert(placeholders).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un placeholder con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updatePlaceholder(id: string, data: PlaceholderInput): Promise<Resultado<typeof placeholders.$inferSelect>> {
  try {
    const [fila] = await db.update(placeholders).set(data).where(eq(placeholders.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un placeholder con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deletePlaceholder(id: string): Promise<Resultado<true>> {
  await db.delete(placeholders).where(eq(placeholders.id, id));
  return { data: true };
}

/**
 * Resolución de ##CODIGO## en un HTML modelo — ver domain/generacion-documentos.md.
 * Dos fases, sin recursión (un placeholder nunca resuelve a otro ##PLACEHOLDER##):
 *
 * 1. Se buscan TODOS los códigos del template de una — si falta alguno, se
 *    corta ahí mismo sin ejecutar ninguna query, informando la lista completa
 *    de faltantes (no uno a la vez).
 * 2. Recién con todos confirmados, se ejecuta cada QUERY en orden. Si una
 *    puntual falla, se corta ahí — se informa CUÁL, no se sigue con las demás.
 */

interface ResolverPlaceholdersResult {
  html?: string;
  error?: string;
}

const PLACEHOLDER_REGEX = /##([A-Za-z0-9_]+)##/g;

function escapeHtml(valor: string): string {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** El QUERY del placeholder recibe $1 como jsonb (casteá $1::jsonb en la query) y devuelve un valor escalar — se toma la primera columna de la primera fila. */
async function ejecutarQueryPlaceholder(query: string, datos: unknown): Promise<string> {
  const filas = await queryClient.unsafe(query, [JSON.stringify(datos)]);
  const primeraFila = filas[0] as Record<string, unknown> | undefined;
  if (!primeraFila) return "";
  const valor = Object.values(primeraFila)[0];
  return valor === null || valor === undefined ? "" : String(valor);
}

export async function resolverPlaceholders(htmlTemplate: string, datos: unknown): Promise<ResolverPlaceholdersResult> {
  const codigos = [...new Set([...htmlTemplate.matchAll(PLACEHOLDER_REGEX)].map((m) => m[1]))];
  if (codigos.length === 0) return { html: htmlTemplate };

  const filas = await db.select().from(placeholders).where(inArray(placeholders.codigo, codigos));
  const porCodigo = new Map(filas.map((f) => [f.codigo, f]));

  const faltantes = codigos.filter((c) => !porCodigo.has(c));
  if (faltantes.length > 0) {
    return { error: `No existen los siguientes placeholders: ${faltantes.join(", ")}.` };
  }

  let html = htmlTemplate;
  for (const codigo of codigos) {
    const placeholder = porCodigo.get(codigo)!;
    let valor: string;
    try {
      valor = await ejecutarQueryPlaceholder(placeholder.query ?? "", datos);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `Error resolviendo el placeholder "${codigo}": ${message}` };
    }
    // NULL trata como "escapar" — un flag sin setear tiene que quedar seguro
    // por default, nunca inseguro por default.
    const valorFinal = placeholder.escapar !== false ? escapeHtml(valor) : valor;
    html = html.replaceAll(`##${codigo}##`, valorFinal);
  }

  return { html };
}
