-- Drena XCC_RECALCULO_PENDIENTE — invocada por el PASO del proceso
-- xcc_procesar_recalculos_pendientes vía `CALL`, cada 1-2 minutos (ver
-- packages/modules/cuenta-corriente/src/seed.ts). 100% base de datos: el
-- trigger encola (0004_...), esta procedure es la única que efectivamente
-- llama a sp_xcc_recalcular_cuenta.
--
-- BEGIN/EXCEPTION/END por cuenta, no una sola sentencia: si una cuenta tira
-- excepción, hace rollback SOLO a su propio savepoint implícito — no hace
-- falta (ni se puede, ver gotcha ya documentado en
-- packages/db/sql/0013_sp_ejecutar_un_proceso_pendiente.sql sobre COMMIT
-- dentro de esta cadena de EXECUTE) ningún COMMIT explícito para lograrlo.
-- Las demás cuentas de la misma pasada siguen procesándose y su trabajo se
-- comitea igual cuando termina el PASO completo — una cuenta rota no bloquea
-- a las demás. La cuenta que falló deja su fila pendiente sin borrar, así
-- que se reintenta sola en la próxima pasada.
CREATE OR REPLACE PROCEDURE sp_xcc_drenar_recalculos_pendientes()
LANGUAGE plpgsql AS $$
DECLARE
  v_pend RECORD;
BEGIN
  FOR v_pend IN SELECT * FROM "XCC_RECALCULO_PENDIENTE" ORDER BY "FECHA_DESDE" LOOP
    BEGIN
      CALL sp_xcc_recalcular_cuenta(v_pend."ID_CUENTA", v_pend."FECHA_DESDE");
      DELETE FROM "XCC_RECALCULO_PENDIENTE" WHERE "ID" = v_pend."ID";
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sp_xcc_drenar_recalculos_pendientes: error recalculando cuenta % (pendiente desde %): %',
        v_pend."ID_CUENTA", v_pend."FECHA_DESDE", SQLERRM;
    END;
  END LOOP;
END;
$$;
