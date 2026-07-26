import { and, eq, gt } from "drizzle-orm";
import { db, usuarios, perfiles } from "@valgian/db";
import { verifyPassword } from "./password";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24; // 24hs — ver ADR 0010 (token único, sin tabla SESIONES)

export async function login(username: string, password: string) {
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.username, username));
  if (!usuario) return null;

  const valid = await verifyPassword(usuario.passwordHash, password);
  if (!valid) return null;

  const token = crypto.randomUUID();
  const tokenExpiracion = new Date(Date.now() + SESSION_DURATION_MS);

  await db.update(usuarios).set({ token, tokenExpiracion }).where(eq(usuarios.id, usuario.id));

  return { token, tokenExpiracion };
}

export async function getSessionUser(token: string) {
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.token, token), gt(usuarios.tokenExpiracion, new Date())));

  if (!usuario) return null;

  const perfil = usuario.idPerfil
    ? (await db.select().from(perfiles).where(eq(perfiles.id, usuario.idPerfil)))[0]
    : null;

  return { usuario, perfil };
}

export async function logout(token: string) {
  await db.update(usuarios).set({ token: null, tokenExpiracion: null }).where(eq(usuarios.token, token));
}
