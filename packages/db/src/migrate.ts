import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida");
}

async function main() {
  const migrationClient = postgres(connectionString!, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    console.log("Corriendo migraciones...");
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("Migraciones aplicadas.");
  } finally {
    await migrationClient.end();
  }
}

main().catch((err) => {
  console.error("Error corriendo migraciones:", err);
  process.exitCode = 1;
});
