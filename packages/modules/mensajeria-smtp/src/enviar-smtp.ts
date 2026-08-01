import nodemailer from "nodemailer";
import type { MensajeParaEnviar, ResultadoEnvioMensaje } from "@valgian/core";

/**
 * Handler del COMPONENTE 'mensajeria_smtp' — manda el mensaje ya resuelto por
 * SMTP genérico (cualquier proveedor: Brevo, Gmail, un relay propio). Las
 * credenciales viven en ACCIONES_EXTERNAS.PARAMETROS (no en .env — a
 * diferencia del resto de la config de infraestructura, ADR 0013, acá puede
 * haber más de un proveedor SMTP configurado a la vez, cada uno su propia
 * fila de ACCIONES_EXTERNAS, así que no encaja en una única variable global).
 */

interface ParametrosSmtp {
  host: string;
  port: number;
  secure?: boolean;
  usuario: string;
  contrasena: string;
  remitente: string;
}

function esParametrosSmtpValidos(p: unknown): p is ParametrosSmtp {
  if (!p || typeof p !== "object") return false;
  const params = p as Partial<ParametrosSmtp>;
  return !!params.host && !!params.port && !!params.usuario && !!params.contrasena && !!params.remitente;
}

export async function enviarPorSmtp(mensaje: MensajeParaEnviar, parametrosAccion: unknown): Promise<ResultadoEnvioMensaje> {
  if (!esParametrosSmtpValidos(parametrosAccion)) {
    return { exito: false, descripcion: "Faltan parámetros SMTP (host/port/usuario/contrasena/remitente) en ACCIONES_EXTERNAS.PARAMETROS." };
  }

  const destinatario = (mensaje.datosRaiz as { destinatario?: string } | null)?.destinatario;
  if (!destinatario) {
    return { exito: false, descripcion: "El mensaje no tiene 'destinatario' en DATOS_RAIZ." };
  }

  const transporte = nodemailer.createTransport({
    host: parametrosAccion.host,
    port: parametrosAccion.port,
    secure: parametrosAccion.secure ?? parametrosAccion.port === 465,
    auth: { user: parametrosAccion.usuario, pass: parametrosAccion.contrasena },
  });

  try {
    await transporte.sendMail({
      from: parametrosAccion.remitente,
      to: destinatario,
      subject: mensaje.asunto ?? "(sin asunto)",
      html: mensaje.cuerpoHtml,
      attachments: mensaje.adjuntos.map((a) => ({ filename: a.nombreOriginal, content: a.buffer, contentType: a.mimetype ?? undefined })),
    });
    return { exito: true, descripcion: `Enviado a ${destinatario}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { exito: false, descripcion: message };
  }
}
