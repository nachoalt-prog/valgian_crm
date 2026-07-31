"use server";

import { revalidatePath } from "next/cache";
import {
  listPlantillasAdjunto,
  crearPlantillaAdjunto,
  actualizarPlantillaAdjunto,
  borrarPlantillaAdjunto,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type ActualizarPlantillaAdjuntoInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "plantillas_adjuntos";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return { usuarioId: session.usuario.id };
}

export async function listPlantillasAdjuntoAction() {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };
  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };
  return { data: await listPlantillasAdjunto() };
}

export async function crearPlantillaAdjuntoAction(formData: FormData) {
  const check = await requireGestion();
  if (check.error || !check.usuarioId) return { error: check.error };

  const codigo = formData.get("codigo");
  const nombre = formData.get("nombre");
  const descripcion = formData.get("descripcion");
  const file = formData.get("file");

  if (typeof codigo !== "string" || typeof nombre !== "string" || !(file instanceof File)) {
    return { error: "Faltan datos." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await crearPlantillaAdjunto({
    codigo,
    nombre,
    descripcion: typeof descripcion === "string" && descripcion ? descripcion : null,
    buffer,
    nombreOriginal: file.name,
    mimetype: file.type || "application/octet-stream",
    idUsuario: check.usuarioId,
  });
  if (result.data) revalidatePath("/dashboard/plantillas-adjuntos");
  return result;
}

export async function actualizarPlantillaAdjuntoAction(id: string, data: ActualizarPlantillaAdjuntoInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await actualizarPlantillaAdjunto(id, data);
  if (result.data) revalidatePath("/dashboard/plantillas-adjuntos");
  return result;
}

export async function borrarPlantillaAdjuntoAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await borrarPlantillaAdjunto(id);
  if (result.data) revalidatePath("/dashboard/plantillas-adjuntos");
  return result;
}
