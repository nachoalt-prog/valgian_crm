import { config } from "dotenv";
import path from "node:path";
import type { NextConfig } from "next";

// El .env vive en la raíz del monorepo, no en apps/web — se carga explícito
// porque Next.js por defecto solo busca .env en su propio directorio.
config({ path: path.resolve(import.meta.dirname, "../../.env") });

const nextConfig: NextConfig = {
  // Los paquetes del workspace se consumen como fuente TS directa (no dist/
  // compilado) — Next no los procesa por default porque resuelven bajo
  // node_modules (symlinks de pnpm). Sin esto, sus exports no se ven.
  transpilePackages: ["@valgian/core", "@valgian/db"],
};

export default nextConfig;
