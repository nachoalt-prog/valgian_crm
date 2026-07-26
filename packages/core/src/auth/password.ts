import { hash, verify } from "@node-rs/argon2";

// Argon2id — ver ADR 0006. Se usa el valor numérico directo (2) en vez del enum
// `Algorithm.Argon2id`: es un const enum, y con isolatedModules (requerido por
// Next/Turbopack) no se puede importar su valor a través de módulos.
const ARGON2ID = 2;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { algorithm: ARGON2ID });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}
