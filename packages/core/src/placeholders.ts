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
 * Sin recursión (un placeholder nunca resuelve a otro ##PLACEHOLDER##).
 *
 * Un ##CODIGO## que no tiene fila en PLACEHOLDERS se ignora — queda tal cual,
 * literal, en el HTML final (no aborta la generación). Deliberado: permite
 * pegar un template con marcadores todavía sin placeholder creado sin que
 * eso bloquee la generación de los demás. Si en cambio el QUERY de un
 * placeholder que SÍ existe falla al ejecutarse, ahí sí se corta — se
 * informa cuál, no se sigue con los demás.
 */

export interface ResolverPlaceholdersResult {
  html?: string;
  /** Mapa código -> valor final sustituido (para auditoría, ej. MENSAJERIA_COLA.PLACEHOLDERS) — solo incluye los que existían en PLACEHOLDERS. */
  valores?: Record<string, string>;
  error?: string;
}

const PLACEHOLDER_REGEX = /##([A-Za-z0-9_]+)##/g;

/**
 * Códigos ##CODIGO## presentes en uno o más textos (HTML o texto plano), SIN
 * resolverlos contra PLACEHOLDERS — dedupe, orden de aparición. La usa
 * resolverPlaceholders por dentro, y también se expone para "solo listar sin
 * resolver" (ej. el modal de "Probar" de Plantillas de Mensajería, sobre
 * ASUNTO + HTML del archivo modelo, sin pegarle a la base).
 */
export function extraerCodigosPlaceholders(...textos: (string | null | undefined)[]): string[] {
  const codigos = new Set<string>();
  for (const texto of textos) {
    if (!texto) continue;
    for (const m of texto.matchAll(PLACEHOLDER_REGEX)) codigos.add(m[1]);
  }
  return [...codigos];
}

/**
 * Sustituye ##CODIGO## en `texto` a partir de un mapa YA resuelto — sin
 * pegarle a PLACEHOLDERS/queries. La usa procesarUnMensaje cuando
 * MENSAJERIA_COLA.PLACEHOLDERS ya viene poblada al encolar (ver
 * domain/acciones-externas.md). A diferencia de resolverPlaceholders, acá no
 * hay PLACEHOLDERS.ESCAPAR que consultar — el llamador es responsable de
 * pasar valores ya listos para insertar. Un código sin entrada en el mapa
 * queda literal (mismo criterio que resolverPlaceholders).
 */
export function sustituirPlaceholdersDesdeMapa(texto: string, valores: Record<string, string>): string {
  let resultado = texto;
  for (const codigo of extraerCodigosPlaceholders(texto)) {
    if (codigo in valores) resultado = resultado.replaceAll(`##${codigo}##`, valores[codigo]);
  }
  return resultado;
}

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
  const codigos = extraerCodigosPlaceholders(htmlTemplate);
  if (codigos.length === 0) return { html: htmlTemplate };

  const filas = await db.select().from(placeholders).where(inArray(placeholders.codigo, codigos));
  const porCodigo = new Map(filas.map((f) => [f.codigo, f]));

  let html = htmlTemplate;
  const valores: Record<string, string> = {};
  for (const codigo of codigos) {
    const placeholder = porCodigo.get(codigo);
    if (!placeholder) continue; // No existe -> se ignora, el ##CODIGO## queda literal.

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
    valores[codigo] = valorFinal;
  }

  return { html, valores };
}
