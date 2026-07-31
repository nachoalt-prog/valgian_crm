import { NextRequest, NextResponse } from "next/server";
import { getArchivoAdjunto, leerArchivoParaDescarga, reemplazarArchivo, borrarArchivo } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { autorizarOperacionArchivo } from "../_shared";

/** RFC 6266/5987: filename ASCII de respaldo + filename* UTF-8 para navegadores modernos (nombres con tildes/espacios). */
function contentDisposition(nombreOriginal: string, inline: boolean): string {
  const nombreAscii = nombreOriginal.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const nombreUtf8 = encodeURIComponent(nombreOriginal);
  const tipo = inline ? "inline" : "attachment";
  return `${tipo}; filename="${nombreAscii}"; filename*=UTF-8''${nombreUtf8}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session?.perfil) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const resultado = await leerArchivoParaDescarga(id);
  if (resultado.error || !resultado.data) {
    return NextResponse.json({ error: resultado.error ?? "No encontrado." }, { status: 404 });
  }

  // Las previsualizaciones (<img>/<embed> src) piden ?inline=1 — con
  // "attachment" el navegador fuerza la descarga en vez de mostrar el
  // contenido embebido (pasaba con los PDF). "Descargar" no manda el
  // parámetro, así que sigue forzando la descarga como corresponde.
  const inline = request.nextUrl.searchParams.get("inline") === "1";

  return new NextResponse(new Uint8Array(resultado.data.buffer), {
    headers: {
      "Content-Type": resultado.data.mimetype ?? "application/octet-stream",
      "Content-Disposition": contentDisposition(resultado.data.nombreOriginal, inline),
      "Content-Length": String(resultado.data.buffer.length),
    },
  });
}

/** Reemplazo — multipart/form-data: file, herramientaCodigo (opcional, no hace falta para el propio avatar), tiposPermitidos (opcional, códigos separados por coma). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existente = await getArchivoAdjunto(id);
  if (!existente) return NextResponse.json({ error: "No existe el archivo adjunto." }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  const herramientaCodigo = formData.get("herramientaCodigo");
  const tiposPermitidosRaw = formData.get("tiposPermitidos");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });

  const auth = await autorizarOperacionArchivo({
    idEntidad: existente.idEntidad,
    idRegistro: existente.idRegistro,
    herramientaCodigo: typeof herramientaCodigo === "string" ? herramientaCodigo : null,
  });
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const buffer = Buffer.from(await file.arrayBuffer());
  const resultado = await reemplazarArchivo({
    id,
    buffer,
    nombreOriginal: file.name,
    mimetype: file.type || "application/octet-stream",
    idUsuario: auth.usuarioId,
    tiposPermitidos: typeof tiposPermitidosRaw === "string" && tiposPermitidosRaw ? tiposPermitidosRaw.split(",") : undefined,
  });

  if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 400 });
  return NextResponse.json({ data: resultado.data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existente = await getArchivoAdjunto(id);
  if (!existente) return NextResponse.json({ error: "No existe el archivo adjunto." }, { status: 404 });

  const herramientaCodigo = request.nextUrl.searchParams.get("herramientaCodigo");
  const auth = await autorizarOperacionArchivo({
    idEntidad: existente.idEntidad,
    idRegistro: existente.idRegistro,
    herramientaCodigo,
  });
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const resultado = await borrarArchivo(id);
  if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 400 });
  return NextResponse.json({ data: true });
}
