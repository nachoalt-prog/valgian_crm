import { count, eq } from "drizzle-orm";
import { db, productos, subProductos } from "@valgian/db";

export interface ProductoConContador {
  id: string;
  modulo: string | null;
  codigo: string;
  nombre: string;
  subProductosCount: number;
}

export async function listProductos(): Promise<ProductoConContador[]> {
  const rows = await db
    .select({
      id: productos.id,
      modulo: productos.modulo,
      codigo: productos.codigo,
      nombre: productos.nombre,
      subProductosCount: count(subProductos.id),
    })
    .from(productos)
    .leftJoin(subProductos, eq(subProductos.idProducto, productos.id))
    .groupBy(productos.id, productos.modulo, productos.codigo, productos.nombre);

  return rows.map((r) => ({ ...r, subProductosCount: Number(r.subProductosCount) }));
}

export interface ProductoInput {
  modulo: string | null;
  codigo: string;
  nombre: string;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
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
  const [{ value: subProductosCount }] = await db
    .select({ value: count() })
    .from(subProductos)
    .where(eq(subProductos.idProducto, id));

  if (Number(subProductosCount) > 0) {
    return {
      error: `No se puede eliminar: tiene ${subProductosCount} sub-producto${Number(subProductosCount) !== 1 ? "s" : ""}.`,
    };
  }

  await db.delete(productos).where(eq(productos.id, id));
  return { data: true };
}

export interface SubProductoConProducto {
  id: string;
  idProducto: string | null;
  codigo: string;
  nombre: string;
  productoNombre: string | null;
}

export async function listSubProductos(productoId?: string): Promise<SubProductoConProducto[]> {
  const base = db
    .select({
      id: subProductos.id,
      idProducto: subProductos.idProducto,
      codigo: subProductos.codigo,
      nombre: subProductos.nombre,
      productoNombre: productos.nombre,
    })
    .from(subProductos)
    .leftJoin(productos, eq(productos.id, subProductos.idProducto));

  if (productoId) return base.where(eq(subProductos.idProducto, productoId));
  return base;
}

export interface SubProductoInput {
  idProducto: string;
  codigo: string;
  nombre: string;
}

export async function createSubProducto(data: SubProductoInput): Promise<Resultado<typeof subProductos.$inferSelect>> {
  try {
    const [fila] = await db.insert(subProductos).values(data).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un sub-producto con el código "${data.codigo}".` };
    throw err;
  }
}

export async function updateSubProducto(
  id: string,
  data: SubProductoInput,
): Promise<Resultado<typeof subProductos.$inferSelect>> {
  try {
    const [fila] = await db.update(subProductos).set(data).where(eq(subProductos.id, id)).returning();
    return { data: fila };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un sub-producto con el código "${data.codigo}".` };
    throw err;
  }
}

export async function deleteSubProducto(id: string): Promise<Resultado<true>> {
  await db.delete(subProductos).where(eq(subProductos.id, id));
  return { data: true };
}
