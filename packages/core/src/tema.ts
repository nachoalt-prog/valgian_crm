import { eq } from "drizzle-orm";
import { db, interfaz } from "@valgian/db";

export interface Tema {
  colorPrimario: string | null;
  colorSecundario: string | null;
  titulo: string | null;
  imagenFondo: string | null;
}

const CAMPOS_TEMA = {
  colorPrimario: interfaz.colorPrimario,
  colorSecundario: interfaz.colorSecundario,
  titulo: interfaz.titulo,
  imagenFondo: interfaz.imagenFondo,
};

/**
 * Interfaz "default" — la que se usa antes de loguearse (login todavía no tiene
 * sesión) y como fallback si el perfil logueado no tiene interfaz asignada.
 */
export async function getTemaPorDefecto(): Promise<Tema | null> {
  const [fila] = await db.select(CAMPOS_TEMA).from(interfaz).where(eq(interfaz.codigo, "default"));
  return fila ?? null;
}

/** Interfaz real de un perfil ya logueado — usada en todo el shell post-login. */
export async function getTemaPorInterfaz(interfazId: string): Promise<Tema | null> {
  const [fila] = await db.select(CAMPOS_TEMA).from(interfaz).where(eq(interfaz.id, interfazId));
  return fila ?? null;
}
