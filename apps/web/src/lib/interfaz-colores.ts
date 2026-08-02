// Colores de énfasis (INTERFAZ.COLOR_PRIMARIO/COLOR_SECUNDARIO) de la última
// sesión logueada en este navegador — persistidos en cookie para que la
// pantalla de login (sin sesión todavía) los pueda usar en vez de caer siempre
// a la interfaz "default". Mismo criterio que THEME_COOKIE (lib/theme.ts):
// cookie, no localStorage, para que el servidor la lea en el primer render.
export const INTERFAZ_COLORES_COOKIE = "interfaz_colores";

export interface InterfazColoresCookie {
  colorPrimario: string | null;
  colorSecundario: string | null;
}

export function parseInterfazColoresCookie(valor: string | undefined): InterfazColoresCookie | null {
  if (!valor) return null;
  try {
    const parsed: unknown = JSON.parse(valor);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { colorPrimario, colorSecundario } = parsed as Record<string, unknown>;
    return {
      colorPrimario: typeof colorPrimario === "string" ? colorPrimario : null,
      colorSecundario: typeof colorSecundario === "string" ? colorSecundario : null,
    };
  } catch {
    return null;
  }
}
