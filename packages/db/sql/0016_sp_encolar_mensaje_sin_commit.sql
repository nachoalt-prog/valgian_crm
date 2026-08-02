-- Versión de SP_MENSAJERIA_ENCOLAR (0009_sp_mensajeria_encolar_destino.sql)
-- SIN los COMMIT internos — para usar desde ACCIONES.COMANDO/PROCESOS_PASOS.COMANDO,
-- que corren vía EXECUTE dinámico (SPI) y nunca admiten control transaccional
-- en la cadena (ver domain/acciones-externas.md, sección "Disparar mensajería
-- desde una transición del motor de estados", y domain/procesos.md). No hacen
-- falta acá: todo confirma junto con la transacción del CALL de más afuera
-- (sp_aplicar_estimulo o sp_ejecutar_un_proceso_pendiente, según quien la use).
--
-- A diferencia de SP_MENSAJERIA_ENCOLAR, el llamador ya tiene que haber
-- resuelto ID_PLANTILLA/ID_ACCION_EXTERNA/ID_ENTIDAD (no acepta el shortcut de
-- "generá el ID acá adentro") — mismo motivo que obligó a sp_notificar_cliente_demo
-- (packages/core/src/seed-demo.ts) a resolver todo en variables antes de esta
-- llamada: Postgres no permite subqueries como argumento de un CALL.
CREATE OR REPLACE PROCEDURE sp_encolar_mensaje_sin_commit(
  p_id_plantilla uuid,
  p_id_accion_externa uuid,
  p_id_entidad uuid,
  p_id_registro uuid,
  p_destino text,
  p_datos jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_mensajeria_cola uuid;
  v_asunto text;
  v_inmediato boolean;
  v_id_entidad_mensajeria uuid;
BEGIN
  IF p_destino IS NULL THEN
    RETURN;
  END IF;

  SELECT "ASUNTO" INTO v_asunto FROM "MENSAJERIA_PLANTILLAS" WHERE "ID" = p_id_plantilla;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT "INMEDIATO" INTO v_inmediato FROM "ACCIONES_EXTERNAS" WHERE "ID" = p_id_accion_externa;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_id_mensajeria_cola := gen_random_uuid();

  INSERT INTO "MENSAJERIA_COLA"
    ("ID", "ID_ACCION_EXTERNA", "ID_MENSAJERIA_PLANTILLA", "ID_ENTIDAD", "ID_REGISTRO", "ASUNTO", "DESTINO", "DATOS_RAIZ", "FECHA_ENCOLADO")
  VALUES
    (v_id_mensajeria_cola, p_id_accion_externa, p_id_plantilla, p_id_entidad, p_id_registro, v_asunto, p_destino, p_datos, now());

  IF v_inmediato THEN
    SELECT "ID" INTO v_id_entidad_mensajeria FROM "ENTIDADES" WHERE "CODIGO" = 'mensajeria_cola';
    IF v_id_entidad_mensajeria IS NOT NULL THEN
      INSERT INTO "ACCIONES_EXTERNAS_COLA" ("ID_ACCION_EXTERNA", "ID_ENTIDAD", "ID_REGISTRO")
      VALUES (p_id_accion_externa, v_id_entidad_mensajeria, v_id_mensajeria_cola);
    END IF;
  END IF;
END;
$$;
