import { eq } from "drizzle-orm";
import { db, closeDb, accionesExternas } from "@valgian/db";

/**
 * Seed propio del módulo — la fila de ACCIONES_EXTERNAS para 'mensajeria_smtp'.
 * Las credenciales SMTP NO se hardcodean acá (no son un dato de ejemplo, son
 * un secreto real) — se toman de variables de entorno si están presentes
 * (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_REMITENTE, ver
 * domain/acciones-externas.md). Sin esas variables, la fila se crea igual
 * pero con PARAMETROS null — no manda nada hasta que alguien las cargue.
 */

async function ensureAccionExterna(
  codigo: string,
  nombre: string,
  componente: string,
  opciones: { parametros: unknown; reintentosMax?: number; reintentosMargen?: number },
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
    })
    .returning();
  return creada;
}

function parametrosSmtpDesdeEnv(): unknown {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_REMITENTE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_REMITENTE) {
    console.log("[mensajeria-smtp] SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_REMITENTE no están todas seteadas — la acción se crea con PARAMETROS null.");
    return null;
  }
  return { host: SMTP_HOST, port: Number(SMTP_PORT), usuario: SMTP_USER, contrasena: SMTP_PASS, remitente: SMTP_REMITENTE };
}

async function main() {
  await ensureAccionExterna("mensajeria_smtp", "Mensajería por Email (SMTP)", "mensajeria_smtp", {
    parametros: parametrosSmtpDesdeEnv(),
    reintentosMax: 3,
    reintentosMargen: 15,
  });

  console.log("Seed de Mensajería SMTP aplicado (idempotente).");
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed de Mensajería SMTP:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
