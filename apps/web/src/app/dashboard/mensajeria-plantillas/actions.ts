"use server";

import { revalidatePath } from "next/cache";
import {
  listMensajeriaPlantillas,
  crearMensajeriaPlantilla,
  actualizarMensajeriaPlantilla,
  borrarMensajeriaPlantilla,
  listEstimulosConEstrategia,
  getPermisoParaOperacion,
  OPERACION_ACCESO,
  type ActualizarMensajeriaPlantillaInput,
} from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

const HERRAMIENTA_CODIGO = "mensajeria_plantillas";
const NO_GESTIONAR = "No tenés permiso de gestión sobre esta herramienta.";

async function requireGestion(): Promise<{ error?: string; usuarioId?: string }> {
  const session = await getCurrentSession();
  if (!session?.perfil || !session.usuario) return { error: "No autenticado." };

  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: NO_GESTIONAR };

  return { usuarioId: session.usuario.id };
}

export async function listMensajeriaPlantillasAction() {
  const session = await getCurrentSession();
  if (!session?.perfil) return { error: "No autenticado." };
  const tieneAcceso = await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO);
  if (!tieneAcceso) return { error: "No tenés acceso a esta herramienta." };
  return { data: await listMensajeriaPlantillas() };
}

export async function listEstimulosParaMensajeriaAction() {
  const check = await requireGestion();
  if (check.error) return { error: check.error };
  return { data: await listEstimulosConEstrategia() };
}

export async function crearMensajeriaPlantillaAction(formData: FormData) {
  const check = await requireGestion();
  if (check.error || !check.usuarioId) return { error: check.error };

  const codigo = formData.get("codigo");
  const nombre = formData.get("nombre");
  const descripcion = formData.get("descripcion");
  const asunto = formData.get("asunto");
  const idEstimuloOk = formData.get("idEstimuloOk");
  const observacionOk = formData.get("observacionOk");
  const idEstimuloError = formData.get("idEstimuloError");
  const observacionError = formData.get("observacionError");
  const file = formData.get("file");

  if (typeof codigo !== "string" || typeof nombre !== "string" || !(file instanceof File)) {
    return { error: "Faltan datos." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await crearMensajeriaPlantilla({
    codigo,
    nombre,
    descripcion: typeof descripcion === "string" && descripcion ? descripcion : null,
    asunto: typeof asunto === "string" && asunto ? asunto : null,
    idEstimuloOk: typeof idEstimuloOk === "string" && idEstimuloOk ? idEstimuloOk : null,
    observacionOk: typeof observacionOk === "string" && observacionOk ? observacionOk : null,
    idEstimuloError: typeof idEstimuloError === "string" && idEstimuloError ? idEstimuloError : null,
    observacionError: typeof observacionError === "string" && observacionError ? observacionError : null,
    buffer,
    nombreOriginal: file.name,
    mimetype: file.type || "application/octet-stream",
    idUsuario: check.usuarioId,
  });
  if (result.data) revalidatePath("/dashboard/mensajeria-plantillas");
  return result;
}

export async function actualizarMensajeriaPlantillaAction(id: string, data: ActualizarMensajeriaPlantillaInput) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await actualizarMensajeriaPlantilla(id, data);
  if (result.data) revalidatePath("/dashboard/mensajeria-plantillas");
  return result;
}

export async function borrarMensajeriaPlantillaAction(id: string) {
  const check = await requireGestion();
  if (check.error) return { error: check.error };

  const result = await borrarMensajeriaPlantilla(id);
  if (result.data) revalidatePath("/dashboard/mensajeria-plantillas");
  return result;
}
