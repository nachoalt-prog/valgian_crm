-- Agrega DESTINO a MENSAJERIA_COLA/SP_MENSAJERIA_ENCOLAR — ver domain/acciones-externas.md
-- (sección Mensajería). CREATE OR REPLACE PROCEDURE no reemplaza si cambia la firma de
-- parámetros (crea un overload nuevo y deja el viejo vivo) — hace falta el DROP explícito.
DROP PROCEDURE IF EXISTS sp_mensajeria_encolar(uuid, uuid, uuid, uuid, uuid, uuid[], jsonb);

CREATE OR REPLACE PROCEDURE sp_mensajeria_encolar(
  p_id_mensajeria_cola uuid,
  p_id_plantilla uuid,
  p_id_accion_externa uuid,
  p_id_entidad uuid,
  p_id_registro uuid,
  p_ids_adjuntos uuid[],
  p_datos jsonb,
  p_destino text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_asunto text;
  v_inmediato boolean;
  v_id_entidad_mensajeria uuid;
  v_id_adjunto uuid;
BEGIN
  SELECT "ASUNTO" INTO v_asunto FROM "MENSAJERIA_PLANTILLAS" WHERE "ID" = p_id_plantilla;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la plantilla de mensajería %', p_id_plantilla;
  END IF;

  SELECT "INMEDIATO" INTO v_inmediato FROM "ACCIONES_EXTERNAS" WHERE "ID" = p_id_accion_externa;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la acción externa %', p_id_accion_externa;
  END IF;

  INSERT INTO "MENSAJERIA_COLA"
    ("ID", "ID_ACCION_EXTERNA", "ID_MENSAJERIA_PLANTILLA", "ID_ENTIDAD", "ID_REGISTRO", "ASUNTO", "DESTINO", "DATOS_RAIZ", "FECHA_ENCOLADO")
  VALUES
    (p_id_mensajeria_cola, p_id_accion_externa, p_id_plantilla, p_id_entidad, p_id_registro, v_asunto, p_destino, p_datos, now());

  IF p_ids_adjuntos IS NOT NULL THEN
    FOREACH v_id_adjunto IN ARRAY p_ids_adjuntos LOOP
      INSERT INTO "MENSAJERIA_COLA_ADJUNTOS" ("ID_MENSAJERIA_COLA", "ID_ARCHIVO_ADJUNTO")
      VALUES (p_id_mensajeria_cola, v_id_adjunto);
    END LOOP;
  END IF;

  COMMIT;

  IF v_inmediato THEN
    SELECT "ID" INTO v_id_entidad_mensajeria FROM "ENTIDADES" WHERE "CODIGO" = 'mensajeria_cola';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe la entidad "mensajeria_cola" en ENTIDADES';
    END IF;

    INSERT INTO "ACCIONES_EXTERNAS_COLA" ("ID_ACCION_EXTERNA", "ID_ENTIDAD", "ID_REGISTRO")
    VALUES (p_id_accion_externa, v_id_entidad_mensajeria, p_id_mensajeria_cola);

    COMMIT;
  END IF;
END;
$$;
