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

const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });

/**
 * Cierra el pool de conexiones — usar SOLO en scripts de vida corta (seed,
 * one-offs) antes de salir. El server de Next.js nunca debería llamar esto:
 * necesita el pool abierto durante toda su vida.
 */
export async function closeDb() {
  await queryClient.end();
}
