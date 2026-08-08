import twilio from "twilio";
import type { MensajeParaEnviar, ResultadoEnvioMensaje } from "@valgian/core";

/**
 * Handler del COMPONENTE 'mensajeria_twilio' — manda el mensaje ya resuelto
 * por SMS vía la API de Twilio. Las credenciales viven en
 * ACCIONES_EXTERNAS.PARAMETROS (mismo criterio que mensajeria-smtp — puede
 * haber más de una cuenta/número de Twilio configurada a la vez, cada una su
 * propia fila de ACCIONES_EXTERNAS).
 *
 * Autenticación por API Key (recomendada por Twilio sobre el Auth Token
 * maestro — se puede revocar sin rotar la cuenta entera), NO accountSid+
 * authToken clásico: `twilio(apiKeySid, apiKeySecret, {accountSid})`. El SDK
 * exige accountSid como opción aparte cuando el primer argumento empieza con
 * "SK" (API Key SID) en vez de "AC" (Account SID) — ver
 * base/BaseTwilio.js:79-83 del paquete `twilio`, tira un error explícito si
 * falta.
 *
 * SMS no soporta adjuntos como SMTP (MMS necesita URLs públicas, y los
 * archivos de este proyecto viven detrás de una ruta autenticada) — si el
 * mensaje trae adjuntos, se ignoran y queda anotado en el resultado, nunca
 * se falla el envío del texto por eso.
 */

interface ParametrosTwilio {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  numeroOrigen: string;
}

function esParametrosTwilioValidos(p: unknown): p is ParametrosTwilio {
  if (!p || typeof p !== "object") return false;
  const params = p as Partial<ParametrosTwilio>;
  return !!params.accountSid && !!params.apiKeySid && !!params.apiKeySecret && !!params.numeroOrigen;
}

export async function enviarPorTwilio(mensaje: MensajeParaEnviar, parametrosAccion: unknown): Promise<ResultadoEnvioMensaje> {
  if (!esParametrosTwilioValidos(parametrosAccion)) {
    return { exito: false, descripcion: "Faltan parámetros de Twilio (accountSid/apiKeySid/apiKeySecret/numeroOrigen) en ACCIONES_EXTERNAS.PARAMETROS." };
  }

  const destinatario = mensaje.destino;
  if (!destinatario) {
    return { exito: false, descripcion: "El mensaje no tiene DESTINO configurado." };
  }

  const cliente = twilio(parametrosAccion.apiKeySid, parametrosAccion.apiKeySecret, { accountSid: parametrosAccion.accountSid });

  try {
    const enviado = await cliente.messages.create({
      from: parametrosAccion.numeroOrigen,
      to: destinatario,
      body: mensaje.cuerpo,
    });

    const avisoAdjuntos = mensaje.adjuntos.length > 0 ? ` (${mensaje.adjuntos.length} adjunto(s) ignorado(s) — SMS no los soporta)` : "";
    return { exito: true, descripcion: `Enviado a ${destinatario} (SID ${enviado.sid})${avisoAdjuntos}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { exito: false, descripcion: message };
  }
}
