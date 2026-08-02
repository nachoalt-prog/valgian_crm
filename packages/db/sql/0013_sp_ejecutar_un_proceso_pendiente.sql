-- Job ejecutor de pg_cron (N idénticos, registrados una única vez cada uno —
-- ver ADR 0015): reclama con FOR UPDATE SKIP LOCKED UNA fila pendiente y
-- vencida de PROCESOS_EJECUCIONES, verificando primero que no haya ya otra
-- ejecución 'procesando' del mismo ID_PROCESO (guard de no-solapamiento,
-- necesario con N ejecutores en paralelo). Si no hay nada elegible, no hace
-- nada. Corre los PASOS uno a uno, comiteando cada uno por separado — el
-- COMANDO de un paso NO puede a su vez llamar a un procedure con COMMIT
-- interno (ej. SP_MENSAJERIA_ENCOLAR): EXECUTE dinámico corre por SPI, que
-- nunca admite control transaccional en la cadena (mismo hallazgo que
-- ACCIONES.COMANDO, ver domain/acciones-externas.md).
--
-- Cancelación cooperativa: ANTES de cada paso (nunca en medio de un EXECUTE
-- ya en curso — no hay forma de interrumpir eso sin matar el backend de
-- Postgres) se relee el ESTADO de la fila. Si alguien la puso en 'cancelada'
-- desde afuera (ver cancelarEjecucionProceso, packages/core/src/procesos.ts),
-- el loop corta ahí — el paso que ya terminó queda registrado, ninguno más
-- arranca, y no se genera reintento.
CREATE OR REPLACE PROCEDURE sp_ejecutar_un_proceso_pendiente()
LANGUAGE plpgsql
AS $$
DECLARE
  v_ejecucion RECORD;
  v_paso RECORD;
  v_desde_orden integer;
  v_hubo_error boolean := false;
  v_cancelada boolean := false;
  v_estado_actual text;
  v_reintento_minutos integer;
  v_reintentos_max integer;
  v_error_mensaje text;
BEGIN
  SELECT pe.* INTO v_ejecucion
  FROM "PROCESOS_EJECUCIONES" pe
  WHERE pe."ESTADO" = 'pendiente'
    AND pe."FECHA_PROGRAMADA" <= now()
    AND NOT EXISTS (
      SELECT 1 FROM "PROCESOS_EJECUCIONES" pe2
      WHERE pe2."ID_PROCESO" = pe."ID_PROCESO" AND pe2."ESTADO" = 'procesando'
    )
  ORDER BY pe."FECHA_PROGRAMADA"
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE "PROCESOS_EJECUCIONES"
  SET "ESTADO" = 'procesando', "FECHA_INICIO" = COALESCE("FECHA_INICIO", now())
  WHERE "ID" = v_ejecucion."ID";
  COMMIT;

  SELECT "REINTENTO_MINUTOS", "REINTENTOS_MAX" INTO v_reintento_minutos, v_reintentos_max
  FROM "PROCESOS" WHERE "ID" = v_ejecucion."ID_PROCESO";

  IF v_ejecucion."ID_PASO_DESDE" IS NOT NULL THEN
    SELECT "ORDEN" INTO v_desde_orden FROM "PROCESOS_PASOS" WHERE "ID" = v_ejecucion."ID_PASO_DESDE";
  ELSE
    v_desde_orden := -2147483648;
  END IF;

  FOR v_paso IN
    SELECT * FROM "PROCESOS_PASOS"
    WHERE "ID_PROCESO" = v_ejecucion."ID_PROCESO" AND "ORDEN" >= v_desde_orden
    ORDER BY "ORDEN"
  LOOP
    SELECT "ESTADO" INTO v_estado_actual FROM "PROCESOS_EJECUCIONES" WHERE "ID" = v_ejecucion."ID";
    IF v_estado_actual = 'cancelada' THEN
      v_cancelada := true;
      EXIT;
    END IF;

    UPDATE "PROCESOS_EJECUCIONES" SET "FECHA_INICIO_PASO" = now() WHERE "ID" = v_ejecucion."ID";
    COMMIT;

    -- El COMMIT tiene que quedar FUERA del bloque BEGIN/EXCEPTION/END: ese
    -- bloque crea una subtransacción implícita (savepoint) en PL/pgSQL, y
    -- Postgres no permite comitear la transacción de nivel superior mientras
    -- una subtransacción sigue activa ("cannot commit while a subtransaction
    -- is active" — probado en vivo, rompía incluso el caso sin ningún error).
    BEGIN
      EXECUTE v_paso."COMANDO";

      INSERT INTO "PROCESOS_EJECUCIONES_PASOS" ("ID_EJECUCION", "ID_PASO", "FECHA_INICIO", "FECHA_FIN", "ESTADO")
      VALUES (v_ejecucion."ID", v_paso."ID", now(), now(), 'completado');

      UPDATE "PROCESOS_EJECUCIONES" SET "ID_ULTIMO_PASO_OK" = v_paso."ID" WHERE "ID" = v_ejecucion."ID";
    EXCEPTION WHEN OTHERS THEN
      v_error_mensaje := SQLERRM;
      v_hubo_error := true;

      INSERT INTO "PROCESOS_EJECUCIONES_PASOS" ("ID_EJECUCION", "ID_PASO", "FECHA_INICIO", "FECHA_FIN", "ESTADO", "ERROR")
      VALUES (v_ejecucion."ID", v_paso."ID", now(), now(), 'error', v_error_mensaje);

      UPDATE "PROCESOS_EJECUCIONES"
      SET "ESTADO" = 'error', "ID_PASO_ERROR" = v_paso."ID", "ERROR" = v_error_mensaje, "FECHA_FIN" = now()
      WHERE "ID" = v_ejecucion."ID";
    END;

    COMMIT;

    IF v_hubo_error THEN
      EXIT;
    END IF;
  END LOOP;

  IF v_cancelada THEN
    -- Ya quedó en 'cancelada' desde afuera — no pisar ese estado, no reintentar.
    NULL;
  ELSIF NOT v_hubo_error THEN
    UPDATE "PROCESOS_EJECUCIONES" SET "ESTADO" = 'completado', "FECHA_FIN" = now() WHERE "ID" = v_ejecucion."ID";
    COMMIT;
  ELSIF v_reintentos_max IS NOT NULL AND v_reintento_minutos IS NOT NULL AND v_ejecucion."NUMERO_INTENTO" < v_reintentos_max THEN
    INSERT INTO "PROCESOS_EJECUCIONES"
      ("ID_PROCESO", "FECHA_PROGRAMADA", "NUMERO_INTENTO", "ID_EJECUCION_ORIGEN", "ESTADO", "ID_PASO_DESDE", "ORIGEN")
    VALUES
      (v_ejecucion."ID_PROCESO", now() + (v_reintento_minutos || ' minutes')::interval, v_ejecucion."NUMERO_INTENTO" + 1, v_ejecucion."ID",
       'pendiente', v_paso."ID", 'reintento')
    ON CONFLICT ("ID_PROCESO", "FECHA_PROGRAMADA") DO NOTHING;
    COMMIT;
  END IF;
END;
$$;
