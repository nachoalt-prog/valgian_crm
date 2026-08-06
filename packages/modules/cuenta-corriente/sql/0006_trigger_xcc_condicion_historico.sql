-- Encola recálculo cuando cambia la condición impositiva vigente de un
-- cliente — falta desde que existe XCC_CLIENTES_CONDICION_HISTORICO (a
-- diferencia de XCC_MOVIMIENTOS/XCC_CUENTAS_TASA_HISTORICO/XCC_CHECKPOINT,
-- que sí tienen su trigger en 0004_trigger_xcc_recalcular.sql). Sin esto, un
-- cambio de condición no dispara ningún recálculo hasta que otro evento
-- (movimiento, consolidación nocturna) toque la cuenta por otro motivo.
--
-- A diferencia de los triggers de 0004 (siempre UNA cuenta, la de
-- NEW."ID_CUENTA"), acá el cliente puede ser titular de VARIAS cuentas — se
-- encola cada una. Mismo guard que fn_xcc_trigger_tasa_historico: una
-- vigencia a futuro no toca el pasado, no hace falta encolar todavía.
CREATE OR REPLACE FUNCTION fn_xcc_trigger_condicion_historico() RETURNS trigger AS $$
DECLARE
  v_cuenta RECORD;
BEGIN
  IF NEW."VIGENTE_DESDE" <= now() THEN
    FOR v_cuenta IN
      SELECT c."ID" AS id_cuenta
      FROM "CLIENTES" cl
      JOIN "CUENTAS" c ON c."ID_LEGAJO" = cl."ID_LEGAJO"
      WHERE cl."ID" = NEW."ID_CLIENTE" AND cl."ES_TITULAR"
    LOOP
      INSERT INTO "XCC_RECALCULO_PENDIENTE" ("ID_CUENTA", "FECHA_DESDE")
      VALUES (v_cuenta.id_cuenta, NEW."VIGENTE_DESDE")
      ON CONFLICT ("ID_CUENTA") DO UPDATE
        SET "FECHA_DESDE" = LEAST("XCC_RECALCULO_PENDIENTE"."FECHA_DESDE", EXCLUDED."FECHA_DESDE");
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xcc_condicion_historico_recalcular ON "XCC_CLIENTES_CONDICION_HISTORICO";
CREATE TRIGGER trg_xcc_condicion_historico_recalcular
  AFTER INSERT ON "XCC_CLIENTES_CONDICION_HISTORICO"
  FOR EACH ROW
  EXECUTE FUNCTION fn_xcc_trigger_condicion_historico();
