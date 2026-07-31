import { NextRequest, NextResponse } from "next/server";
import { guardarArchivo } from "@valgian/core";
import { autorizarOperacionArchivo } from "./_shared";

function campoOpcional(valor: FormDataEntryValue | null): string | null {
  return typeof valor === "string" && valor ? valor : null;
}

/** Alta de un archivo adjunto — multipart/form-data: file, idEntidad/idRegistro (vacíos para un archivo global, ej. plantillas), herramientaCodigo (opcional, no hace falta para el propio avatar), tiposPermitidos (opcional, códigos separados por coma). */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const idEntidad = campoOpcional(formData.get("idEntidad"));
  const idRegistro = campoOpcional(formData.get("idRegistro"));
  const herramientaCodigo = campoOpcional(formData.get("herramientaCodigo"));
  const tiposPermitidosRaw = campoOpcional(formData.get("tiposPermitidos"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Faltan datos del archivo." }, { status: 400 });
  }

  const auth = await autorizarOperacionArchivo({ idEntidad, idRegistro, herramientaCodigo, accion: "crear" });
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const buffer = Buffer.from(await file.arrayBuffer());
  const resultado = await guardarArchivo({
    idEntidad,
    idRegistro,
    buffer,
    nombreOriginal: file.name,
    mimetype: file.type || "application/octet-stream",
    idUsuario: auth.usuarioId,
    tiposPermitidos: tiposPermitidosRaw ? tiposPermitidosRaw.split(",") : undefined,
  });

  if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 400 });
  return NextResponse.json({ data: resultado.data });
}
