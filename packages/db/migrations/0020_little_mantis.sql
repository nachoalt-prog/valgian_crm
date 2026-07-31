-- Copia las asociaciones existentes antes de perder las columnas — idempotente
-- (ON CONFLICT contra el unique de ARCHIVOS_ADJUNTOS_ENTIDADES) para que una
-- base ya migrada a mano (dev) o una base fresca (sin filas que copiar) no
-- fallen ni dupliquen.
INSERT INTO "ARCHIVOS_ADJUNTOS_ENTIDADES" ("ID_ARCHIVO_ADJUNTO", "ID_ENTIDAD", "ID_REGISTRO")
SELECT "ID", "ID_ENTIDAD", "ID_REGISTRO" FROM "ARCHIVOS_ADJUNTOS" WHERE "ID_ENTIDAD" IS NOT NULL
ON CONFLICT ("ID_ARCHIVO_ADJUNTO", "ID_ENTIDAD", "ID_REGISTRO") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "ARCHIVOS_ADJUNTOS" DROP CONSTRAINT "ARCHIVOS_ADJUNTOS_ID_ENTIDAD_ENTIDADES_ID_fk";
--> statement-breakpoint
ALTER TABLE "ARCHIVOS_ADJUNTOS" DROP COLUMN "ID_ENTIDAD";--> statement-breakpoint
ALTER TABLE "ARCHIVOS_ADJUNTOS" DROP COLUMN "ID_REGISTRO";