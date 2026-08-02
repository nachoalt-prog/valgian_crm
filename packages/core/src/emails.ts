import { eq } from "drizzle-orm";
import { db, emails } from "@valgian/db";

/**
 * Emails de un cliente — ver domain/core.md, sección Clientes. ABM propio,
 * embebido en el modal de Legajo dentro de Clientes. PRINCIPAL sigue la misma
 * lógica de "único activo, auto-swap" que CLIENTES.ES_TITULAR (trigger
 * `fn_emails_principal_unico`, packages/db/sql/0010_trigger_emails_principal.sql).
 */

export interface EmailFila {
  id: string;
  email: string;
  principal: boolean | null;
  idCliente: string | null;
}

export async function listEmailsPorCliente(idCliente: string): Promise<EmailFila[]> {
  return db
    .select({ id: emails.id, email: emails.email, principal: emails.principal, idCliente: emails.idCliente })
    .from(emails)
    .where(eq(emails.idCliente, idCliente))
    .orderBy(emails.email);
}

export interface EmailInput {
  idCliente: string;
  email: string;
  principal: boolean;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

export async function createEmail(data: EmailInput, idUsuarioAudit: string): Promise<Resultado<typeof emails.$inferSelect>> {
  const ahora = new Date();
  const [fila] = await db
    .insert(emails)
    .values({ ...data, altaFecha: ahora, altaUsuario: idUsuarioAudit, auditFecha: ahora, auditUsuario: idUsuarioAudit })
    .returning();
  return { data: fila };
}

export async function updateEmail(id: string, data: EmailInput, idUsuarioAudit: string): Promise<Resultado<typeof emails.$inferSelect>> {
  const [fila] = await db
    .update(emails)
    .set({ ...data, auditFecha: new Date(), auditUsuario: idUsuarioAudit })
    .where(eq(emails.id, id))
    .returning();
  return { data: fila };
}

export async function deleteEmail(id: string): Promise<Resultado<true>> {
  await db.delete(emails).where(eq(emails.id, id));
  return { data: true };
}
