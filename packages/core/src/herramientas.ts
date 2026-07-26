import { db, herramientas } from "@valgian/db";

/** Catálogo de HERRAMIENTAS — hoy solo se registran por seed/código, sin ABM propio. */
export async function listHerramientas() {
  return db.select({ id: herramientas.id, codigo: herramientas.codigo, nombre: herramientas.nombre }).from(herramientas);
}
