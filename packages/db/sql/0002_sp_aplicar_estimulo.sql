-- Motor de estados: aplica un estímulo sobre un registro de una entidad
-- cualquiera (LEGAJOS, CUENTAS, etc. — resuelto dinámicamente vía
-- ENTIDADES.NOMBRE, que guarda el nombre real de la tabla). Ver ADR 0009 y
-- domain/motor-de-estados.md.
--
-- Es un PROCEDURE (no una función) a propósito: necesita controlar sus
-- propias transacciones internas. El cambio de estado + el alta en HISTORIAL
-- se confirman con un COMMIT antes de correr las ACCIONES — si una acción
-- falla, esa parte ya quedó firme (no se revierte), solo se anota el error
-- en el mismo registro de HISTORIAL.
CREATE OR REPLACE PROCEDURE sp_aplicar_estimulo(
  p_id_entidad uuid,
  p_id_relacion uuid,
  p_id_estimulo uuid,
  p_id_usuario uuid,
  p_observacion text DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_tabla text;
  v_estado_actual uuid;
  v_id_transicion uuid;
  v_id_estado_1 uuid;
  v_id_historial uuid;
  v_accion RECORD;
  v_error_msg text;
BEGIN
  -- 1. Nombre real de la tabla de la entidad.
  SELECT "NOMBRE" INTO v_tabla FROM "ENTIDADES" WHERE "ID" = p_id_entidad;
  IF v_tabla IS NULL THEN
    RAISE EXCEPTION 'No existe la entidad %', p_id_entidad;
  END IF;

  -- Nombre de tabla validado contra un identificador simple antes de usarlo
  -- en SQL dinámico — defensivo, aunque ENTIDADES es contenido de confianza.
  IF v_tabla !~ '^[A-Za-z_][A-Za-z0-9_]*$' THEN
    RAISE EXCEPTION 'Nombre de tabla inválido en ENTIDADES: %', v_tabla;
  END IF;

  -- 2. Estado actual del registro puntual (SQL dinámico: la tabla depende de la entidad).
  EXECUTE format('SELECT "ID_ESTADO" FROM %I WHERE "ID" = $1', v_tabla)
    INTO v_estado_actual
    USING p_id_relacion;

  IF v_estado_actual IS NULL THEN
    RAISE EXCEPTION 'No se encontró el registro % en % (o no tiene estado)', p_id_relacion, v_tabla;
  END IF;

  -- 3. Debe existir una única transición válida para (estado actual, estímulo).
  -- SELECT ... INTO STRICT hace de "exactamente una fila": lanza NO_DATA_FOUND
  -- si no hay ninguna, TOO_MANY_ROWS si hay más de una.
  BEGIN
    SELECT "ID", "ID_ESTADO_1" INTO STRICT v_id_transicion, v_id_estado_1
    FROM "TRANSICIONES"
    WHERE "ID_ESTADO_0" = v_estado_actual AND "ID_ESTIMULO" = p_id_estimulo;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE EXCEPTION 'No existe una transición válida para el estado actual y el estímulo indicado';
    WHEN TOO_MANY_ROWS THEN
      RAISE EXCEPTION 'Configuración inconsistente: hay más de una transición para el mismo estado y estímulo';
  END;

  -- 4. Cambio de estado + alta en HISTORIAL, atómico.
  EXECUTE format('UPDATE %I SET "ID_ESTADO" = $1, "AUDIT_FECHA" = now(), "AUDIT_USUARIO" = $2 WHERE "ID" = $3', v_tabla)
    USING v_id_estado_1, p_id_usuario, p_id_relacion;

  INSERT INTO "HISTORIAL" ("ID_ESTADO_0", "ID_ESTIMULO", "ID_ESTADO_1", "ID_ENTIDAD", "ID_RELACION", "OBSERVACION", "AUDIT_FECHA", "AUDIT_USUARIO")
  VALUES (v_estado_actual, p_id_estimulo, v_id_estado_1, p_id_entidad, p_id_relacion, p_observacion, now(), p_id_usuario)
  RETURNING "ID" INTO v_id_historial;

  COMMIT;

  -- 5. Acciones en orden — separadas del impacto en HISTORIAL a propósito
  -- (ver domain/motor-de-estados.md): si una falla, se corta la cadena y se
  -- anota el error en el mismo registro de HISTORIAL ya confirmado; el
  -- cambio de estado y el historial del paso 4 no se revierten.
  -- Convención de ACCIONES.COMANDO: SQL con un solo placeholder $1 = ID_RELACION.
  FOR v_accion IN
    SELECT A."COMANDO"
    FROM "TRANSICIONES_ACCIONES" TA
    JOIN "ACCIONES" A ON A."ID" = TA."ID_ACCION"
    WHERE TA."ID_TRANSICION" = v_id_transicion
    ORDER BY TA."ORDEN"
  LOOP
    BEGIN
      EXECUTE v_accion."COMANDO" USING p_id_relacion;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
      UPDATE "HISTORIAL" SET "ACCIONES_STATUS" = 1, "ACCIONES_ERROR" = v_error_msg WHERE "ID" = v_id_historial;
      COMMIT;
      RETURN;
    END;
  END LOOP;

  COMMIT;
END;
$$;
