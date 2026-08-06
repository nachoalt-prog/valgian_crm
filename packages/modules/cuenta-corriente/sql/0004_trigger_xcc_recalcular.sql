-- Encola en XCC_RECALCULO_PENDIENTE cuando entra algo que puede afectar el
-- pasado de una cuenta: un movimiento con fecha pasada, un cambio de tasa
-- retroactivo, o un checkpoint. La fecha desde la que hay que recalcular
-- siempre se conoce directo (es la fecha de la fila que acaba de entrar) —
-- no hace falta detectar nada, a diferencia del REG_ORDEN del legacy.
--
-- NO llaman a sp_xcc_recalcular_cuenta directo — un recálculo retroactivo
-- viejo puede recorrer miles de días, y hacerlo dentro de la misma
-- transacción del INSERT que lo dispara bloquearía a quien lo cargó; una
-- carga masiva (importar historial de una cuenta) dispararía ese recálculo
-- completo una vez por cada fila insertada (cuadrático). Se desacopla
-- encolando (ver docs/domain/cuenta-corriente.md, incluida la evaluación de por
-- qué esto es 100% base de datos, sin worker de Node) — el proceso
-- xcc_procesar_recalculos_pendientes (cada 2 min, CALL a
-- sp_xcc_drenar_recalculos_pendientes, ver seed.ts del módulo) es el único
-- camino que efectivamente llama al motor.
--
-- ON CONFLICT (ID_CUENTA) DO UPDATE ... LEAST(...): si ya hay un pendiente
-- para esa cuenta, se queda con la FECHA_DESDE más antigua de las dos —
-- recalcular desde antes siempre cubre lo que hubiera que recalcular desde
-- después, así que nunca hace falta más de una fila pendiente por cuenta.
CREATE OR REPLACE FUNCTION fn_xcc_trigger_movimiento() RETURNS trigger AS $$
BEGIN
  INSERT INTO "XCC_RECALCULO_PENDIENTE" ("ID_CUENTA", "FECHA_DESDE")
  VALUES (NEW."ID_CUENTA", date_trunc('day', NEW."FECHA"))
  ON CONFLICT ("ID_CUENTA") DO UPDATE
    SET "FECHA_DESDE" = LEAST("XCC_RECALCULO_PENDIENTE"."FECHA_DESDE", EXCLUDED."FECHA_DESDE");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xcc_movimiento_recalcular ON "XCC_MOVIMIENTOS";
CREATE TRIGGER trg_xcc_movimiento_recalcular
  AFTER INSERT ON "XCC_MOVIMIENTOS"
  FOR EACH ROW
  EXECUTE FUNCTION fn_xcc_trigger_movimiento();

CREATE OR REPLACE FUNCTION fn_xcc_trigger_tasa_historico() RETURNS trigger AS $$
BEGIN
  -- Una tasa a futuro (VIGENTE_DESDE > ahora) no cambia nada del pasado —
  -- no hace falta encolar todavía, se aplica sola cuando llegue la fecha.
  IF NEW."VIGENTE_DESDE" <= now() THEN
    INSERT INTO "XCC_RECALCULO_PENDIENTE" ("ID_CUENTA", "FECHA_DESDE")
    VALUES (NEW."ID_CUENTA", NEW."VIGENTE_DESDE")
    ON CONFLICT ("ID_CUENTA") DO UPDATE
      SET "FECHA_DESDE" = LEAST("XCC_RECALCULO_PENDIENTE"."FECHA_DESDE", EXCLUDED."FECHA_DESDE");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xcc_tasa_historico_recalcular ON "XCC_CUENTAS_TASA_HISTORICO";
CREATE TRIGGER trg_xcc_tasa_historico_recalcular
  AFTER INSERT ON "XCC_CUENTAS_TASA_HISTORICO"
  FOR EACH ROW
  EXECUTE FUNCTION fn_xcc_trigger_tasa_historico();

CREATE OR REPLACE FUNCTION fn_xcc_trigger_checkpoint() RETURNS trigger AS $$
BEGIN
  INSERT INTO "XCC_RECALCULO_PENDIENTE" ("ID_CUENTA", "FECHA_DESDE")
  VALUES (NEW."ID_CUENTA", NEW."FECHA")
  ON CONFLICT ("ID_CUENTA") DO UPDATE
    SET "FECHA_DESDE" = LEAST("XCC_RECALCULO_PENDIENTE"."FECHA_DESDE", EXCLUDED."FECHA_DESDE");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_xcc_checkpoint_recalcular ON "XCC_CHECKPOINT";
CREATE TRIGGER trg_xcc_checkpoint_recalcular
  AFTER INSERT ON "XCC_CHECKPOINT"
  FOR EACH ROW
  EXECUTE FUNCTION fn_xcc_trigger_checkpoint();
