CREATE TABLE "XCC_RECALCULO_PENDIENTE" (
	"ID" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ID_CUENTA" uuid NOT NULL,
	"FECHA_DESDE" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "XCC_SALDOS" ADD COLUMN "ID_TIPO_RETENCION" uuid;--> statement-breakpoint
ALTER TABLE "XCC_TIPOS_RETENCION" ADD COLUMN "USA_CONDICION_IMPOSITIVA" boolean;--> statement-breakpoint
ALTER TABLE "XCC_RECALCULO_PENDIENTE" ADD CONSTRAINT "XCC_RECALCULO_PENDIENTE_ID_CUENTA_CUENTAS_ID_fk" FOREIGN KEY ("ID_CUENTA") REFERENCES "public"."CUENTAS"("ID") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "XCC_RECALCULO_PENDIENTE_ID_CUENTA_UNIQUE" ON "XCC_RECALCULO_PENDIENTE" USING btree ("ID_CUENTA");--> statement-breakpoint
ALTER TABLE "XCC_SALDOS" ADD CONSTRAINT "XCC_SALDOS_ID_TIPO_RETENCION_XCC_TIPOS_RETENCION_ID_fk" FOREIGN KEY ("ID_TIPO_RETENCION") REFERENCES "public"."XCC_TIPOS_RETENCION"("ID") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill: la retención de Ganancias ya estaba sembrada desde la Fase 2
-- (ver packages/modules/cuenta-corriente/src/seed.ts) sin esta columna —
-- el seed es insert-only/idempotente, no la va a corregir sola.
UPDATE "XCC_TIPOS_RETENCION" SET "USA_CONDICION_IMPOSITIVA" = true WHERE "CODIGO" = 'ganancias';