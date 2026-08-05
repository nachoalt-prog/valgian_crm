import { count, eq } from "drizzle-orm";
import { db, categoriasProductos, productos } from "@valgian/db";

export interface CategoriaProductoConContador {
  id: string;
  modulo: string | null;
  codigo: string;
  nombre: string;
  spPago: string | null;
  spAnularPago: string | null;
  productosCount: number;
}

export async function listCategoriasProductos(): Promise<CategoriaProductoConContador[]> {
  const rows = await db
    .select({
      id: categoriasProductos.id,
      modulo: categoriasProductos.modulo,
      codigo: categoriasProductos.codigo,
      nombre: categoriasProductos.nombre,
      spPago: categoriasProductos.spPago,
      spAnularPago: categoriasProductos.spAnularPago,
      productosCount: count(productos.id),
    })
    .from(categoriasProductos)
    .leftJoin(productos, eq(productos.idCategoria, categoriasProductos.id))
    .groupBy(categoriasProductos.id, categoriasProductos.modulo, categoriasProductos.codigo, categoriasProductos.nombre, categoriasProductos.spPago, categoriasProductos.spAnularPago);

  return rows.map((r) => ({ ...r, productosCount: Number(r.productosCount) }));
}

export interface CategoriaProductoInput {
  modulo: string | null;
  codigo: string;
  nombre: string;
  spPago: string | null;
  spAnularPago: string | null;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createCategoriaProducto(data: CategoriaProductoInput): Promise<Resultado<typeof categoriasProductos.$inferSelect>> {
  try {
    const [fila] = await db.insert(categoriasProductos).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una categoría con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateCategoriaProducto(id: string, data: CategoriaProductoInput): Promise<Resultado<typeof categoriasProductos.$inferSelect>> {
  try {
    const [fila] = await db.update(categoriasProductos).set(data).where(eq(categoriasProductos.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe una categoría con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteCategoriaProducto(id: string): Promise<Resultado<true>> {
  const [{ value: productosCount }] = await db
    .select({ value: count() })
    .from(productos)
    .where(eq(productos.idCategoria, id));

  if (Number(productosCount) > 0) {
    return {
      error: `No se puede eliminar: tiene ${productosCount} producto${Number(productosCount) !== 1 ? "s" : ""}.`,
    };
  }

  await db.delete(categoriasProductos).where(eq(categoriasProductos.id, id));
  return { data: true };
}

export interface ProductoConCategoria {
  id: string;
  idCategoria: string | null;
  idMoneda: string | null;
  codigo: string;
  nombre: string;
  categoriaNombre: string | null;
}

export async function listProductos(categoriaId?: string): Promise<ProductoConCategoria[]> {
  const base = db
    .select({
      id: productos.id,
      idCategoria: productos.idCategoria,
      idMoneda: productos.idMoneda,
      codigo: productos.codigo,
      nombre: productos.nombre,
      categoriaNombre: categoriasProductos.nombre,
    })
    .from(productos)
    .leftJoin(categoriasProductos, eq(categoriasProductos.id, productos.idCategoria));

  if (categoriaId) return base.where(eq(productos.idCategoria, categoriaId));
  return base;
}

export interface ProductoInput {
  idCategoria: string;
  idMoneda: string | null;
  codigo: string;
  nombre: string;
}

export async function createProducto(data: ProductoInput): Promise<Resultado<typeof productos.$inferSelect>> {
  try {
    const [fila] = await db.insert(productos).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un producto con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateProducto(id: string, data: ProductoInput): Promise<Resultado<typeof productos.$inferSelect>> {
  try {
    const [fila] = await db.update(productos).set(data).where(eq(productos.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un producto con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteProducto(id: string): Promise<Resultado<true>> {
  await db.delete(productos).where(eq(productos.id, id));
  return { data: true };
}
