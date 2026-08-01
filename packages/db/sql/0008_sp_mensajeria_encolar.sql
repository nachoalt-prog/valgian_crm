-- SP_MENSAJERIA_ENCOLAR: encola un mensaje (mail/SMS/WhatsApp/lo que sea) +
-- sus adjuntos, y si la ACCIONES_EXTERNAS elegida es de disparo inmediato,
-- dispara también la cola genérica para que se procese ya. Ver
-- domain/acciones-externas.md, sección Mensajería.
--
-- p_id_mensajeria_cola: UUID a usar, generado por el llamador (packages/core)
-- antes de invocar — mismo criterio que sp_gestionar_tramite, evita la
-- complejidad de parámetros OUT en un CALL invocado desde postgres.js.
--
-- p_datos: jsonb con los datos raíz para resolver los ##CODIGO## del cuerpo y
-- del asunto (mismo rol que GENERACIONES_DOCUMENTO.DATOS) — la resolución en
-- sí la hace el componente al mandar (es código Node, esta SP solo la
-- persiste en DATOS_RAIZ para que sobreviva hasta ese momento).
CREATE OR REPLACE PROCEDURE sp_mensajeria_encolar(
  p_id_mensajeria_cola uuid,
  p_id_plantilla uuid,
  p_id_accion_externa uuid,
  p_id_entidad uuid,
  p_id_registro uuid,
  p_ids_adjuntos uuid[],
  p_datos jsonb
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
    ("ID", "ID_ACCION_EXTERNA", "ID_MENSAJERIA_PLANTILLA", "ID_ENTIDAD", "ID_REGISTRO", "ASUNTO", "DATOS_RAIZ", "FECHA_ENCOLADO")
  VALUES
    (p_id_mensajeria_cola, p_id_accion_externa, p_id_plantilla, p_id_entidad, p_id_registro, v_asunto, p_datos, now());

  IF p_ids_adjuntos IS NOT NULL THEN
    FOREACH v_id_adjunto IN ARRAY p_ids_adjuntos LOOP
      INSERT INTO "MENSAJERIA_COLA_ADJUNTOS" ("ID_MENSAJERIA_COLA", "ID_ARCHIVO_ADJUNTO")
      VALUES (p_id_mensajeria_cola, v_id_adjunto);
    END LOOP;
  END IF;

  COMMIT;

  -- Con INMEDIATO=false, se asume que algo más (a futuro, un PASO de
  -- Procesos) va a insertar esta fila más tarde, de una sola vez para varios
  -- mensajes juntos — ver domain/acciones-externas.md.
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
