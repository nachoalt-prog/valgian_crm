"use server";

import { guardarArchivo, reemplazarArchivo, getEntidadPorCodigo, setAvatarUsuario } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";

/**
 * Sube o reemplaza la foto de perfil del usuario logueado. No pasa por el
 * route handler genérico de archivos adjuntos — es una acción específica
 * (subir + vincular USUARIOS.ID_ARCHIVO_ADJUNTO cuando es la primera vez),
 * más simple como Server Action directa, consistente con el resto del sistema.
 */
export async function actualizarAvatarAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session?.usuario) return { error: "No autenticado." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Falta el archivo." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimetype = file.type || "application/octet-stream";

  if (session.usuario.idArchivoAdjunto) {
    const resultado = await reemplazarArchivo({
      id: session.usuario.idArchivoAdjunto,
      buffer,
      nombreOriginal: file.name,
      mimetype,
      idUsuario: session.usuario.id,
    });
    if (resultado.error || !resultado.data) return { error: resultado.error ?? "Error reemplazando el avatar." };
    return { data: { id: resultado.data.id } };
  }

  const entidadUsuarios = await getEntidadPorCodigo("usuarios");
  if (!entidadUsuarios) return { error: 'No existe ENTIDADES.CODIGO = "usuarios".' };

  const resultado = await guardarArchivo({
    idEntidad: entidadUsuarios.id,
    idRegistro: session.usuario.id,
    buffer,
    nombreOriginal: file.name,
    mimetype,
    idUsuario: session.usuario.id,
  });
  if (resultado.error || !resultado.data) return { error: resultado.error ?? "Error guardando el avatar." };

  await setAvatarUsuario(session.usuario.id, resultado.data.id);
  return { data: { id: resultado.data.id } };
}
