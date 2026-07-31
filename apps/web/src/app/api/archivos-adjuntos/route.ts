import { NextRequest, NextResponse } from "next/server";
import { guardarArchivo } from "@valgian/core";
import { autorizarOperacionArchivo } from "./_shared";

/** Alta de un archivo adjunto — multipart/form-data: file, idEntidad, idRegistro, herramientaCodigo (opcional, no hace falta para el propio avatar). */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const idEntidad = formData.get("idEntidad");
  const idRegistro = formData.get("idRegistro");
  const herramientaCodigo = formData.get("herramientaCodigo");

  if (!(file instanceof File) || typeof idEntidad !== "string" || typeof idRegistro !== "string") {
    return NextResponse.json({ error: "Faltan datos del archivo." }, { status: 400 });
  }

  const auth = await autorizarOperacionArchivo({
    idEntidad,
    idRegistro,
    herramientaCodigo: typeof herramientaCodigo === "string" ? herramientaCodigo : null,
  });
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const buffer = Buffer.from(await file.arrayBuffer());
  const resultado = await guardarArchivo({
    idEntidad,
    idRegistro,
    buffer,
    nombreOriginal: file.name,
    mimetype: file.type || "application/octet-stream",
    idUsuario: auth.usuarioId,
  });

  if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 400 });
  return NextResponse.json({ data: resultado.data });
}
