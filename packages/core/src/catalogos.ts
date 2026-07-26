import { db, caracteres, tiposDocumento, generos, provincias } from "@valgian/db";

/** Catálogos de apoyo para formularios de CLIENTES (y otros). */

export async function listCaracteres() {
  return db.select().from(caracteres).orderBy(caracteres.nombre);
}

export async function listTiposDocumento() {
  return db.select().from(tiposDocumento).orderBy(tiposDocumento.nombre);
}

export async function listGeneros() {
  return db.select().from(generos).orderBy(generos.nombre);
}

export async function listProvincias() {
  return db.select().from(provincias).orderBy(provincias.nombre);
}
