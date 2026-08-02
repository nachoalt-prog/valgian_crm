-- Filas 'procesando' cuyo paso EN CURSO superó su TIMEOUT_MINUTOS (comparado
-- contra FECHA_INICIO_PASO, no FECHA_INICIO) — Postgres se cayó a mitad de
-- una ejecución. Se marcan 'error' sin ID_PASO_ERROR (no se pudo capturar la
-- excepción real) y siguen la misma lógica de reintento. Cuenta como intento
-- fallido contra REINTENTOS_MAX — no es un reintento gratis. Ver ADR 0015,
-- domain/procesos.md.
CREATE OR REPLACE PROCEDURE sp_barrer_procesos_huerfanos()
LANGUAGE plpgsql
AS $$
DECLARE
  v_huerfana RECORD;
  v_paso_actual RECORD;
  v_reintento_minutos integer;
  v_reintentos_max integer;
BEGIN
  FOR v_huerfana IN
    SELECT * FROM "PROCESOS_EJECUCIONES"
    WHERE "ESTADO" = 'procesando' AND "FECHA_INICIO_PASO" IS NOT NULL
  LOOP
    -- El paso EN CURSO es el siguiente a ID_ULTIMO_PASO_OK (o el primero, si es null).
    SELECT pp.* INTO v_paso_actual
    FROM "PROCESOS_PASOS" pp
    WHERE pp."ID_PROCESO" = v_huerfana."ID_PROCESO"
      AND pp."ORDEN" > COALESCE((SELECT "ORDEN" FROM "PROCESOS_PASOS" WHERE "ID" = v_huerfana."ID_ULTIMO_PASO_OK"), -2147483648)
    ORDER BY pp."ORDEN"
    LIMIT 1;

    IF v_paso_actual."ID" IS NULL OR v_paso_actual."TIMEOUT_MINUTOS" IS NULL THEN
      CONTINUE;
    END IF;

    IF v_huerfana."FECHA_INICIO_PASO" >= now() - (v_paso_actual."TIMEOUT_MINUTOS" || ' minutes')::interval THEN
      CONTINUE;
    END IF;

    UPDATE "PROCESOS_EJECUCIONES"
    SET "ESTADO" = 'error',
        "ERROR" = 'Timeout del paso "' || v_paso_actual."NOMBRE" || '" superado (huérfana — probable caída de Postgres a mitad de ejecución).',
        "FECHA_FIN" = now()
    WHERE "ID" = v_huerfana."ID";

    SELECT "REINTENTO_MINUTOS", "REINTENTOS_MAX" INTO v_reintento_minutos, v_reintentos_max
    FROM "PROCESOS" WHERE "ID" = v_huerfana."ID_PROCESO";

    IF v_reintentos_max IS NOT NULL AND v_reintento_minutos IS NOT NULL AND v_huerfana."NUMERO_INTENTO" < v_reintentos_max THEN
      INSERT INTO "PROCESOS_EJECUCIONES"
        ("ID_PROCESO", "FECHA_PROGRAMADA", "NUMERO_INTENTO", "ID_EJECUCION_ORIGEN", "ESTADO", "ID_PASO_DESDE", "ORIGEN")
      VALUES
        (v_huerfana."ID_PROCESO", now() + (v_reintento_minutos || ' minutes')::interval, v_huerfana."NUMERO_INTENTO" + 1, v_huerfana."ID",
         'pendiente', v_paso_actual."ID", 'reintento')
      ON CONFLICT ("ID_PROCESO", "FECHA_PROGRAMADA") DO NOTHING;
    END IF;

    COMMIT;
  END LOOP;
END;
$$;
