-- Mismos parámetros nuevos que 0017 (p_placeholders/p_forzar_inmediato), en
-- paridad, sobre sp_encolar_mensaje_sin_commit — ver
-- domain/acciones-externas.md, sección "Probar una plantilla". Ningún caller
-- de hoy (ACCIONES.COMANDO/PROCESOS_PASOS.COMANDO) los usa todavía — quedan
-- disponibles por si algún día hace falta desde ahí. CREATE OR REPLACE
-- PROCEDURE no reemplaza si cambia la firma — hace falta el DROP explícito.
DROP PROCEDURE IF EXISTS sp_encolar_mensaje_sin_commit(uuid, uuid, uuid, uuid, text, jsonb);

CREATE OR REPLACE PROCEDURE sp_encolar_mensaje_sin_commit(
  p_id_plantilla uuid,
  p_id_accion_externa uuid,
  p_id_entidad uuid,
  p_id_registro uuid,
  p_destino text,
  p_datos jsonb,
  p_placeholders jsonb DEFAULT NULL,
  p_forzar_inmediato boolean DEFAULT false
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
    ("ID", "ID_ACCION_EXTERNA", "ID_MENSAJERIA_PLANTILLA", "ID_ENTIDAD", "ID_REGISTRO", "ASUNTO", "DESTINO", "PLACEHOLDERS_DATOS_RAIZ", "PLACEHOLDERS", "FECHA_ENCOLADO")
  VALUES
    (v_id_mensajeria_cola, p_id_accion_externa, p_id_plantilla, p_id_entidad, p_id_registro, v_asunto, p_destino, p_datos, p_placeholders, now());

  IF v_inmediato OR p_forzar_inmediato THEN
    SELECT "ID" INTO v_id_entidad_mensajeria FROM "ENTIDADES" WHERE "CODIGO" = 'mensajeria_cola';
    IF v_id_entidad_mensajeria IS NOT NULL THEN
      INSERT INTO "ACCIONES_EXTERNAS_COLA" ("ID_ACCION_EXTERNA", "ID_ENTIDAD", "ID_REGISTRO")
      VALUES (p_id_accion_externa, v_id_entidad_mensajeria, v_id_mensajeria_cola);
    END IF;
  END IF;
END;
$$;
