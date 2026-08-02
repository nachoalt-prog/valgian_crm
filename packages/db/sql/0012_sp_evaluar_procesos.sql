-- Job evaluador de pg_cron (1 solo, liviano, registrado una única vez — ver
-- ADR 0015): cada minuto, por cada PROCESO activo cuyo CRON matchea el
-- instante actual, encola una fila en PROCESOS_EJECUCIONES. Nunca corre
-- COMANDO de negocio — nunca se bloquea.
CREATE OR REPLACE PROCEDURE sp_evaluar_procesos()
LANGUAGE plpgsql
AS $$
DECLARE
  v_proceso RECORD;
  v_ahora timestamptz := date_trunc('minute', now());
BEGIN
  FOR v_proceso IN SELECT "ID" FROM "PROCESOS" WHERE "ACTIVO" = true AND fn_cron_matches("CRON", v_ahora) LOOP
    INSERT INTO "PROCESOS_EJECUCIONES" ("ID_PROCESO", "FECHA_PROGRAMADA", "ORIGEN", "ESTADO")
    VALUES (v_proceso."ID", v_ahora, 'cron', 'pendiente')
    ON CONFLICT ("ID_PROCESO", "FECHA_PROGRAMADA") DO NOTHING;
  END LOOP;

  COMMIT;
END;
$$;
