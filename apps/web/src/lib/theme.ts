// Tema claro/oscuro — persistido en cookie (no localStorage) para que el
// servidor pueda leerlo en el primer render (SSR sin flash, ver layout.tsx).
// Sin cookie todavía: se sigue prefers-color-scheme del SO (corregido antes
// del primer paint por el script inline en layout.tsx) — ver domain/infraestructura.md.
export const THEME_COOKIE = "theme";
export type Theme = "light" | "dark";

export function setThemeCookie(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}
