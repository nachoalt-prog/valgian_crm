import { eq } from "drizzle-orm";
import { db, closeDb, accionesExternas } from "@valgian/db";

/**
 * Seed propio del módulo — la fila de ACCIONES_EXTERNAS para
 * 'mensajeria_twilio'. Las credenciales de Twilio NO se hardcodean acá (no
 * son un dato de ejemplo, son un secreto real) — se toman de variables de
 * entorno si están presentes (TWILIO_ACCOUNT_SID/TWILIO_API_KEY_SID/
 * TWILIO_API_KEY_SECRET/TWILIO_FROM, ver domain/acciones-externas.md). Sin
 * esas variables, la fila se crea igual pero con PARAMETROS null — no manda
 * nada hasta que alguien las cargue.
 */

async function ensureAccionExterna(
  codigo: string,
  nombre: string,
  componente: string,
  opciones: { parametros: unknown; reintentosMax?: number; reintentosMargen?: number; mensajeria?: boolean },
) {
  const [existente] = await db.select().from(accionesExternas).where(eq(accionesExternas.codigo, codigo));
  if (existente) return existente;

  const [creada] = await db
    .insert(accionesExternas)
    .values({
      codigo,
      nombre,
      componente,
      parametros: opciones.parametros,
      reintentosMax: opciones.reintentosMax,
      reintentosMargen: opciones.reintentosMargen,
      mensajeria: opciones.mensajeria,
    })
    .returning();
  return creada;
}

function parametrosTwilioDesdeEnv(): unknown {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET || !TWILIO_FROM) {
    console.log(
      "[mensajeria-twilio] TWILIO_ACCOUNT_SID/TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET/TWILIO_FROM no están todas seteadas — la acción se crea con PARAMETROS null.",
    );
    return null;
  }
  return { accountSid: TWILIO_ACCOUNT_SID, apiKeySid: TWILIO_API_KEY_SID, apiKeySecret: TWILIO_API_KEY_SECRET, numeroOrigen: TWILIO_FROM };
}

async function main() {
  await ensureAccionExterna("mensajeria_twilio", "Mensajería por SMS (Twilio)", "mensajeria_twilio", {
    parametros: parametrosTwilioDesdeEnv(),
    reintentosMax: 3,
    reintentosMargen: 15,
    mensajeria: true,
  });

  console.log("Seed de Mensajería Twilio aplicado (idempotente).");
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed de Mensajería Twilio:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
