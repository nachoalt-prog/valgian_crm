"use server";

import { revalidatePath } from "next/cache";
import {
  createProducto,
  updateProducto,
  deleteProducto,
  createSubProducto,
  updateSubProducto,
  deleteSubProducto,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type ProductoInput,
  type SubProductoInput,
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

export async function createSubProductoAction(data: SubProductoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await createSubProducto(data);
  if (result.data) revalidatePath("/dashboard/productos");
  return result;
}

export async function updateSubProductoAction(id: string, data: SubProductoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await updateSubProducto(id, data);
  if (result.data) revalidatePath("/dashboard/productos");
  return result;
}

export async function deleteSubProductoAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await deleteSubProducto(id);
  if (result.data) revalidatePath("/dashboard/productos");
  return result;
}
