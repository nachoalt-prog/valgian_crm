import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida");
}

// En dev, Next.js re-evalúa este módulo en cada hot-reload sin cerrar el pool
// anterior — sin cachear en globalThis, cada recarga abre una conexión nueva
// hasta agotar max_connections de Postgres (nos pasó varias veces esta sesión).
declare global {
  var __valgianQueryClient: ReturnType<typeof postgres> | undefined;
}

const queryClient = globalThis.__valgianQueryClient ?? postgres(connectionString);

if (process.env.NODE_ENV !== "production") {
  globalThis.__valgianQueryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });

/**
 * Cierra el pool de conexiones — usar SOLO en scripts de vida corta (seed,
 * one-offs) antes de salir. El server de Next.js nunca debería llamar esto:
 * necesita el pool abierto durante toda su vida.
 */
export async function closeDb() {
  await queryClient.end();
}
