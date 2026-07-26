import { eq } from "drizzle-orm";
import { db, usuarios, perfiles } from "@valgian/db";
import { hashPassword } from "./auth/password";

export interface UsuarioConPerfil {
  id: string;
  idPerfil: string | null;
  username: string;
  token: string | null;
  avatarPath: string | null;
  perfilCodigo: string | null;
  perfilNombre: string | null;
}

export async function listUsuarios(perfilId?: string): Promise<UsuarioConPerfil[]> {
  const base = db
    .select({
      id: usuarios.id,
      idPerfil: usuarios.idPerfil,
      username: usuarios.username,
      token: usuarios.token,
      avatarPath: usuarios.avatarPath,
      perfilCodigo: perfiles.codigo,
      perfilNombre: perfiles.nombre,
    })
    .from(usuarios)
    .leftJoin(perfiles, eq(perfiles.id, usuarios.idPerfil));

  if (perfilId) {
    return base.where(eq(usuarios.idPerfil, perfilId));
  }
  return base;
}

export interface UsuarioInput {
  idPerfil: string | null;
  username: string;
  password?: string;
  avatarPath: string | null;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

function esViolacionUnica(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export async function createUsuario(data: UsuarioInput): Promise<Resultado<typeof usuarios.$inferSelect>> {
  if (!data.password) {
    return { error: "La contraseña es requerida para crear un usuario." };
  }
  try {
    const passwordHash = await hashPassword(data.password);
    const [usuario] = await db
      .insert(usuarios)
      .values({
        idPerfil: data.idPerfil,
        username: data.username,
        passwordHash,
        avatarPath: data.avatarPath,
      })
      .returning();
    return { data: usuario };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un usuario con el username "${data.username}".` };
    throw err;
  }
}

export async function updateUsuario(id: string, data: UsuarioInput): Promise<Resultado<typeof usuarios.$inferSelect>> {
  try {
    const set: Partial<typeof usuarios.$inferInsert> = {
      idPerfil: data.idPerfil,
      username: data.username,
      avatarPath: data.avatarPath,
    };
    if (data.password) {
      set.passwordHash = await hashPassword(data.password);
    }
    const [usuario] = await db.update(usuarios).set(set).where(eq(usuarios.id, id)).returning();
    return { data: usuario };
  } catch (err) {
    if (esViolacionUnica(err)) return { error: `Ya existe un usuario con el username "${data.username}".` };
    throw err;
  }
}

export async function deleteUsuario(id: string): Promise<Resultado<true>> {
  await db.delete(usuarios).where(eq(usuarios.id, id));
  return { data: true };
}
