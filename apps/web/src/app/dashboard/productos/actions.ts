"use server";

import { revalidatePath } from "next/cache";
import {
  createCategoriaProducto,
  updateCategoriaProducto,
  deleteCategoriaProducto,
  createProducto,
  updateProducto,
  deleteProducto,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type CategoriaProductoInput,
  type ProductoInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "productos";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return {};
}

export async function createCategoriaProductoAction(data: CategoriaProductoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createCategoriaProducto(data);
  if (result.data) revalidatePath("/dashboard/productos");
  return result;
}

export async function updateCategoriaProductoAction(id: string, data: CategoriaProductoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateCategoriaProducto(id, data);
  if (result.data) revalidatePath("/dashboard/productos");
  return result;
}

export async function deleteCategoriaProductoAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteCategoriaProducto(id);
  if (result.data) revalidatePath("/dashboard/productos");
  return result;
}

export async function createProductoAction(data: ProductoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createProducto(data);
  if (result.data) revalidatePath("/dashboard/productos");
  return result;
}

export async function updateProductoAction(id: string, data: ProductoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateProducto(id, data);
  if (result.data) revalidatePath("/dashboard/productos");
  return result;
}

export async function deleteProductoAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteProducto(id);
  if (result.data) revalidatePath("/dashboard/productos");
  return result;
}
