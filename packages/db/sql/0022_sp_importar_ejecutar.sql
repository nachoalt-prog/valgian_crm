-- Motor de importación de archivos — orquestador SQL puro (nada de
-- filesystem acá, eso lo hace Node antes/después de este CALL — ver ADR 0021
-- y packages/core/src/importadores.ts). Recibe una IMPORTADORES_EJECUCIONES
-- ya con su tabla de staging cargada, corre el SP configurado del importador
-- (validar, y opcionalmente impactar), y las etapas fijas/opcionales que
-- siguen (mover a histórico, borrar staging, limpiar histórico viejo).
--
-- Es un PROCEDURE (no una función) a propósito, mismo motivo que
-- sp_aplicar_estimulo (0002_...): controla sus propias transacciones. Cada
-- etapa que ya hizo cambios reales (validar, impactar) se confirma con
-- COMMIT antes de seguir — si una etapa posterior falla, lo ya hecho no se
-- pierde, solo se anota el error.
--
-- p_solo_validar=true es el camino del wizard: corta después de validar
-- (ESTADO='esperando_confirmacion'), una segunda llamada con false —
-- disparada recién cuando el usuario confirma— sigue desde ahí. En modo
-- automático (MODO_ARCHIVO='buscar_directorio') nunca se llama con true,
-- sigue derecho y decide solo según MODO_ERROR_AUTOMATICO.
CREATE OR REPLACE PROCEDURE sp_importar_ejecutar(
  p_id_ejecucion uuid,
  p_solo_validar boolean DEFAULT false
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_ejecucion RECORD;
  v_error_msg text;
  v_total integer;
  v_ok integer;
  v_advertencia integer;
  v_error integer;
  v_columnas text;
BEGIN
  SELECT ie.*, i."TABLA_STAGING", i."SP_NOMBRE", i."TABLA_HISTORICO", i."DIAS_RETENCION_HISTORICO", i."MODO_ERROR_AUTOMATICO"
    INTO v_ejecucion
    FROM "IMPORTADORES_EJECUCIONES" ie
    JOIN "IMPORTADORES" i ON i."ID" = ie."ID_IMPORTADOR"
    WHERE ie."ID" = p_id_ejecucion;

  IF v_ejecucion IS NULL THEN
    RAISE EXCEPTION 'No existe la ejecución de importador %', p_id_ejecucion;
  END IF;

  -- Identificadores validados contra un patrón simple antes de cualquier SQL
  -- dinámico — mismo criterio que sp_aplicar_estimulo (0002_..., línea 37).
  IF v_ejecucion."SP_NOMBRE" !~ '^[A-Za-z_][A-Za-z0-9_]*$' THEN
    RAISE EXCEPTION 'Nombre de SP inválido en IMPORTADORES: %', v_ejecucion."SP_NOMBRE";
  END IF;
  IF v_ejecucion."TABLA_STAGING" !~ '^[A-Za-z_][A-Za-z0-9_]*$' THEN
    RAISE EXCEPTION 'Nombre de tabla de staging inválido en IMPORTADORES: %', v_ejecucion."TABLA_STAGING";
  END IF;
  IF v_ejecucion."TABLA_HISTORICO" IS NOT NULL AND v_ejecucion."TABLA_HISTORICO" !~ '^[A-Za-z_][A-Za-z0-9_]*$' THEN
    RAISE EXCEPTION 'Nombre de tabla histórica inválido en IMPORTADORES: %', v_ejecucion."TABLA_HISTORICO";
  END IF;

  -- 1. Validar — el SP del importador actualiza ESTADO_VALIDACION/MENSAJE_VALIDACION
  -- fila por fila en su tabla de staging, filtrando por ID_EJECUCION.
  UPDATE "IMPORTADORES_EJECUCIONES" SET "ESTADO" = 'validando' WHERE "ID" = p_id_ejecucion;
  COMMIT;

  BEGIN
    EXECUTE format('CALL %I($1, $2)', v_ejecucion."SP_NOMBRE") USING p_id_ejecucion, 'validar';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    UPDATE "IMPORTADORES_EJECUCIONES" SET "ESTADO" = 'error', "ERROR" = v_error_msg, "FECHA_FIN" = now() WHERE "ID" = p_id_ejecucion;
    COMMIT;
    RETURN;
  END;

  EXECUTE format(
    'SELECT count(*) FILTER (WHERE "ESTADO_VALIDACION" = ''ok''), count(*) FILTER (WHERE "ESTADO_VALIDACION" = ''advertencia''), count(*) FILTER (WHERE "ESTADO_VALIDACION" = ''error''), count(*) FROM %I WHERE "ID_EJECUCION" = $1',
    v_ejecucion."TABLA_STAGING"
  ) INTO v_ok, v_advertencia, v_error, v_total USING p_id_ejecucion;

  UPDATE "IMPORTADORES_EJECUCIONES"
  SET "RESUMEN_VALIDACION" = jsonb_build_object('total', v_total, 'ok', v_ok, 'advertencia', v_advertencia, 'error', v_error)
  WHERE "ID" = p_id_ejecucion;

  IF p_solo_validar THEN
    UPDATE "IMPORTADORES_EJECUCIONES" SET "ESTADO" = 'esperando_confirmacion' WHERE "ID" = p_id_ejecucion;
    COMMIT;
    RETURN;
  END IF;

  -- 2. Wizard ya confirmó (por eso llegó acá con p_solo_validar=false) — sigue
  -- siempre. Automático respeta MODO_ERROR_AUTOMATICO (default 'abortar' si
  -- por algún motivo quedó sin configurar).
  IF v_ejecucion."MODO_ARCHIVO" = 'buscar_directorio'
     AND COALESCE(v_ejecucion."MODO_ERROR_AUTOMATICO", 'abortar') = 'abortar'
     AND v_error > 0 THEN
    UPDATE "IMPORTADORES_EJECUCIONES"
    SET "ESTADO" = 'error', "ERROR" = format('%s fila(s) con error de validación — MODO_ERROR_AUTOMATICO=abortar', v_error), "FECHA_FIN" = now()
    WHERE "ID" = p_id_ejecucion;
    COMMIT;
    RETURN;
  END IF;

  -- 3. Impactar.
  UPDATE "IMPORTADORES_EJECUCIONES" SET "ESTADO" = 'impactando' WHERE "ID" = p_id_ejecucion;
  COMMIT;

  -- El COMMIT del camino sin error va DESPUÉS de END, nunca dentro del bloque
  -- BEGIN/EXCEPTION — un bloque con EXCEPTION es una subtransacción mientras
  -- esté abierto (hasta su END); COMMIT ahí tira "cannot commit while a
  -- subtransaction is active" (bug real, encontrado corriendo la
  -- verificación de este mismo archivo). El COMMIT DENTRO del handler
  -- EXCEPTION sí vale — para cuando se llega ahí, Postgres ya hizo el ROLLBACK
  -- TO SAVEPOINT implícito y ese código corre en el contexto de la
  -- transacción de afuera (mismo patrón que sp_aplicar_estimulo, 0002_...).
  BEGIN
    EXECUTE format('CALL %I($1, $2)', v_ejecucion."SP_NOMBRE") USING p_id_ejecucion, 'impactar';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    UPDATE "IMPORTADORES_EJECUCIONES" SET "ESTADO" = 'error', "ERROR" = v_error_msg, "FECHA_FIN" = now() WHERE "ID" = p_id_ejecucion;
    COMMIT;
    RETURN;
  END;
  COMMIT;

  -- 4. Mover a histórico (opcional) — histórico tiene el MISMO CONJUNTO de
  -- columnas que staging (ver domain/importadores.md), pero no necesariamente
  -- en el mismo orden físico (ej. una columna agregada después con ALTER
  -- TABLE queda al final en una tabla y no en la otra según cuándo se creó
  -- cada una) — un "INSERT ... SELECT *" ingenuo emparejaría por POSICIÓN y
  -- podría escribir el valor equivocado en la columna equivocada sin tirar
  -- error si los tipos coinciden, o tirar un error de tipo confuso si no
  -- (bug real, encontrado corriendo la verificación de este mismo archivo).
  -- Arma la lista de columnas explícita por NOMBRE (menos "ID", que cada
  -- tabla genera con su propio DEFAULT) para no depender del orden físico.
  IF v_ejecucion."TABLA_HISTORICO" IS NOT NULL THEN
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO v_columnas
      FROM information_schema.columns
      WHERE table_name = v_ejecucion."TABLA_STAGING" AND column_name <> 'ID';

    EXECUTE format(
      'INSERT INTO %I (%s) SELECT %s FROM %I WHERE "ID_EJECUCION" = $1',
      v_ejecucion."TABLA_HISTORICO", v_columnas, v_columnas, v_ejecucion."TABLA_STAGING"
    ) USING p_id_ejecucion;
  END IF;

  -- 5. Borrar staging de esta ejecución (fijo, siempre).
  EXECUTE format('DELETE FROM %I WHERE "ID_EJECUCION" = $1', v_ejecucion."TABLA_STAGING") USING p_id_ejecucion;

  -- 6. Limpiar histórico viejo (opcional) — por antigüedad de la ejecución
  -- dueña de cada fila (FECHA_FIN de IMPORTADORES_EJECUCIONES), no una fecha
  -- propia del histórico.
  IF v_ejecucion."TABLA_HISTORICO" IS NOT NULL AND v_ejecucion."DIAS_RETENCION_HISTORICO" IS NOT NULL THEN
    EXECUTE format(
      'DELETE FROM %I WHERE "ID_EJECUCION" IN (SELECT "ID" FROM "IMPORTADORES_EJECUCIONES" WHERE "FECHA_FIN" < now() - ($1 || ''days'')::interval)',
      v_ejecucion."TABLA_HISTORICO"
    ) USING v_ejecucion."DIAS_RETENCION_HISTORICO";
  END IF;

  UPDATE "IMPORTADORES_EJECUCIONES" SET "ESTADO" = 'completado', "FECHA_FIN" = now() WHERE "ID" = p_id_ejecucion;
  COMMIT;
END;
$$;
