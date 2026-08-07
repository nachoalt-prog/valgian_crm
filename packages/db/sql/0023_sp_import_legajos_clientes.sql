-- Primer importador real del motor de importación (Fase 3, ver ADR 0021,
-- domain/importadores.md). Una fila de IMPORT_LEGAJOS_CLIENTES_STG trae
-- datos de un LEGAJO y/o un CLIENTE (mapeo fijo, no dinámico).
--
-- LEGAJO: se busca por NUMERO — si no existe se crea (ID_ESTADO = el
-- ES_INICIAL de la estrategia STD_LEGAJO_1, mismo criterio que
-- packages/core/src/seed-demo.ts). Si ya existe, no se toca nada más de
-- él acá — el estado lo gobierna el motor de estados (sp_aplicar_estimulo),
-- nunca un import ciego.
--
-- CLIENTE: se busca por (ID_TIPO_DOCUMENTO, NRO_DOCUMENTO) — si no existe se
-- crea, si existe se actualiza SOLO lo que vino en el archivo. Vacío/NULL en
-- una columna de CLIENTE_* significa "no vino", nunca "borrar el valor
-- existente" (COALESCE contra el valor actual). CLIENTES.ES_TITULAR usa el
-- trigger ya existente (0001_trigger_clientes_titular.sql) para la unicidad
-- por legajo — este SP no necesita ocuparse de eso.
CREATE OR REPLACE PROCEDURE sp_import_legajos_clientes(
  p_id_ejecucion uuid,
  p_operacion text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_estado_inicial uuid;
  v_id_usuario_disparo uuid;
  v_row RECORD;
  v_id_legajo uuid;
  v_id_tipo_documento uuid;
  v_id_genero uuid;
  v_id_provincia uuid;
  v_id_caracter uuid;
  v_es_titular boolean;
  v_id_cliente uuid;
  v_cliente_id_legajo uuid;
  v_legajo_numero_previo text;
  v_error text;
  v_legajos_creados integer := 0;
  v_legajos_existentes integer := 0;
  v_clientes_creados integer := 0;
  v_clientes_actualizados integer := 0;
  v_filas_solo_legajo integer := 0;
BEGIN
  SELECT ie."ID_USUARIO_DISPARO" INTO v_id_usuario_disparo FROM "IMPORTADORES_EJECUCIONES" ie WHERE ie."ID" = p_id_ejecucion;
  IF v_id_usuario_disparo IS NULL THEN
    RAISE EXCEPTION 'No existe la ejecución de importador %', p_id_ejecucion;
  END IF;

  SELECT e."ID" INTO v_id_estado_inicial
  FROM "ESTADOS" e JOIN "ESTRATEGIAS" es ON es."ID" = e."ID_ESTRATEGIA"
  WHERE es."CODIGO" = 'STD_LEGAJO_1' AND e."ES_INICIAL" = true;
  IF v_id_estado_inicial IS NULL THEN
    RAISE EXCEPTION 'No existe ESTADOS.ES_INICIAL para la estrategia STD_LEGAJO_1 — correr el seed de configuración primero.';
  END IF;

  IF p_operacion = 'validar' THEN
    FOR v_row IN SELECT * FROM "IMPORT_LEGAJOS_CLIENTES_STG" WHERE "ID_EJECUCION" = p_id_ejecucion ORDER BY "NRO_FILA" LOOP
      v_error := NULL;
      v_id_legajo := NULL;
      v_id_cliente := NULL;
      v_cliente_id_legajo := NULL;

      IF NULLIF(trim(v_row."LEGAJO_NUMERO"), '') IS NULL THEN
        v_error := 'Falta LEGAJO_NUMERO.';
      END IF;

      -- Tipo+nro de documento vienen juntos, o ninguno de los dos.
      IF v_error IS NULL AND (NULLIF(v_row."CLIENTE_TIPO_DOCUMENTO_CODIGO", '') IS NOT NULL) <> (NULLIF(v_row."CLIENTE_NRO_DOCUMENTO", '') IS NOT NULL) THEN
        v_error := 'CLIENTE_TIPO_DOCUMENTO_CODIGO y CLIENTE_NRO_DOCUMENTO tienen que venir juntos o ninguno de los dos.';
      END IF;

      -- Cualquier otro dato de cliente sin NRO_DOCUMENTO es un dato huérfano — probable error de carga, no una fila "solo legajo" legítima.
      IF v_error IS NULL AND NULLIF(v_row."CLIENTE_NRO_DOCUMENTO", '') IS NULL AND (
        NULLIF(v_row."CLIENTE_ES_TITULAR", '') IS NOT NULL OR NULLIF(v_row."CLIENTE_CARACTER_CODIGO", '') IS NOT NULL OR
        NULLIF(v_row."CLIENTE_APELLIDO", '') IS NOT NULL OR NULLIF(v_row."CLIENTE_NOMBRE", '') IS NOT NULL OR
        NULLIF(v_row."CLIENTE_GENERO_CODIGO", '') IS NOT NULL OR NULLIF(v_row."CLIENTE_PROVINCIA_CODIGO", '') IS NOT NULL
      ) THEN
        v_error := 'Hay datos de cliente pero falta CLIENTE_NRO_DOCUMENTO/CLIENTE_TIPO_DOCUMENTO_CODIGO.';
      END IF;

      IF v_error IS NULL AND NULLIF(v_row."CLIENTE_NRO_DOCUMENTO", '') IS NOT NULL THEN
        SELECT "ID" INTO v_id_tipo_documento FROM "TIPOS_DOCUMENTO" WHERE "CODIGO" = v_row."CLIENTE_TIPO_DOCUMENTO_CODIGO";
        IF v_id_tipo_documento IS NULL THEN
          v_error := format('Tipo de documento desconocido: "%s".', v_row."CLIENTE_TIPO_DOCUMENTO_CODIGO");
        END IF;
      END IF;

      IF v_error IS NULL AND NULLIF(v_row."CLIENTE_GENERO_CODIGO", '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "GENEROS" WHERE "CODIGO" = v_row."CLIENTE_GENERO_CODIGO") THEN
        v_error := format('Género desconocido: "%s".', v_row."CLIENTE_GENERO_CODIGO");
      END IF;

      IF v_error IS NULL AND NULLIF(v_row."CLIENTE_PROVINCIA_CODIGO", '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "PROVINCIAS" WHERE "CODIGO" = v_row."CLIENTE_PROVINCIA_CODIGO") THEN
        v_error := format('Provincia desconocida: "%s".', v_row."CLIENTE_PROVINCIA_CODIGO");
      END IF;

      IF v_error IS NULL AND NULLIF(v_row."CLIENTE_CARACTER_CODIGO", '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CARACTERES" WHERE "CODIGO" = v_row."CLIENTE_CARACTER_CODIGO") THEN
        v_error := format('Carácter de cliente desconocido: "%s".', v_row."CLIENTE_CARACTER_CODIGO");
      END IF;

      IF v_error IS NULL AND NULLIF(v_row."CLIENTE_ES_TITULAR", '') IS NOT NULL
         AND lower(trim(v_row."CLIENTE_ES_TITULAR")) NOT IN ('true', 'false', 'si', 'sí', 'no', '1', '0') THEN
        v_error := format('CLIENTE_ES_TITULAR inválido: "%s" (usar true/false/si/no/1/0).', v_row."CLIENTE_ES_TITULAR");
      END IF;

      IF v_error IS NULL AND NULLIF(v_row."CLIENTE_NRO_DOCUMENTO", '') IS NOT NULL THEN
        SELECT "ID", "ID_LEGAJO" INTO v_id_cliente, v_cliente_id_legajo
        FROM "CLIENTES" WHERE "ID_TIPO_DOCUMENTO" = v_id_tipo_documento AND "NRO_DOCUMENTO" = v_row."CLIENTE_NRO_DOCUMENTO";

        -- Si no existe todavía en CLIENTES, puede que una fila ANTERIOR de este
        -- mismo archivo ya lo vaya a crear (ej. titular en la fila 1, co-titular
        -- del mismo DNI corregido en la fila 3) — impactar procesa en el mismo
        -- orden (NRO_FILA), secuencial, así que para cuando le toque a esta fila
        -- el cliente ya va a existir. Sin este chequeo, cualquier archivo con más
        -- de una fila para el mismo cliente rompería la validación en la 2da fila.
        v_legajo_numero_previo := NULL;
        IF v_id_cliente IS NULL THEN
          SELECT "LEGAJO_NUMERO" INTO v_legajo_numero_previo
          FROM "IMPORT_LEGAJOS_CLIENTES_STG"
          WHERE "ID_EJECUCION" = p_id_ejecucion
            AND "NRO_FILA" < v_row."NRO_FILA"
            AND "ESTADO_VALIDACION" = 'ok'
            AND "CLIENTE_TIPO_DOCUMENTO_CODIGO" = v_row."CLIENTE_TIPO_DOCUMENTO_CODIGO"
            AND "CLIENTE_NRO_DOCUMENTO" = v_row."CLIENTE_NRO_DOCUMENTO"
          ORDER BY "NRO_FILA" DESC
          LIMIT 1;
        END IF;

        -- Cliente genuinamente nuevo (ni en CLIENTES ni en una fila anterior de
        -- este archivo) necesita NOMBRE — NOT NULL en CLIENTES. La primera fila
        -- donde aparece un cliente nuevo es la que tiene que traer los datos
        -- completos si es la que lo va a crear.
        IF v_id_cliente IS NULL AND v_legajo_numero_previo IS NULL AND NULLIF(v_row."CLIENTE_NOMBRE", '') IS NULL THEN
          v_error := 'Cliente nuevo (no existe ese tipo+nro de documento) necesita CLIENTE_NOMBRE.';
        END IF;

        -- Conflicto de legajo: contra CLIENTES real si el cliente ya existe
        -- (IS DISTINCT FROM también atrapa "legajo del archivo todavía no
        -- existe" — v_id_legajo NULL), o contra la fila anterior de este mismo
        -- archivo si todavía no existe en la base.
        IF v_error IS NULL AND v_id_cliente IS NOT NULL AND v_cliente_id_legajo IS NOT NULL THEN
          SELECT "ID" INTO v_id_legajo FROM "LEGAJOS" WHERE "NUMERO" = v_row."LEGAJO_NUMERO";
          IF v_id_legajo IS DISTINCT FROM v_cliente_id_legajo THEN
            v_error := 'Ese cliente ya pertenece a otro legajo.';
          END IF;
        ELSIF v_error IS NULL AND v_legajo_numero_previo IS NOT NULL AND v_legajo_numero_previo <> v_row."LEGAJO_NUMERO" THEN
          v_error := 'Ese cliente ya pertenece a otro legajo (según una fila anterior de este mismo archivo).';
        END IF;
      END IF;

      UPDATE "IMPORT_LEGAJOS_CLIENTES_STG"
      SET "ESTADO_VALIDACION" = CASE WHEN v_error IS NULL THEN 'ok' ELSE 'error' END,
          "MENSAJE_VALIDACION" = v_error
      WHERE "ID" = v_row."ID";
    END LOOP;

  ELSIF p_operacion = 'impactar' THEN
    FOR v_row IN
      SELECT * FROM "IMPORT_LEGAJOS_CLIENTES_STG"
      WHERE "ID_EJECUCION" = p_id_ejecucion AND "ESTADO_VALIDACION" = 'ok'
      ORDER BY "NRO_FILA"
    LOOP
      SELECT "ID" INTO v_id_legajo FROM "LEGAJOS" WHERE "NUMERO" = v_row."LEGAJO_NUMERO";
      IF v_id_legajo IS NULL THEN
        INSERT INTO "LEGAJOS" ("NUMERO", "ID_ESTADO", "ALTA_FECHA", "ALTA_USUARIO", "AUDIT_FECHA", "AUDIT_USUARIO")
        VALUES (v_row."LEGAJO_NUMERO", v_id_estado_inicial, now(), v_id_usuario_disparo, now(), v_id_usuario_disparo)
        RETURNING "ID" INTO v_id_legajo;
        v_legajos_creados := v_legajos_creados + 1;
      ELSE
        v_legajos_existentes := v_legajos_existentes + 1;
      END IF;

      IF NULLIF(v_row."CLIENTE_NRO_DOCUMENTO", '') IS NULL THEN
        v_filas_solo_legajo := v_filas_solo_legajo + 1;
        CONTINUE;
      END IF;

      SELECT "ID" INTO v_id_tipo_documento FROM "TIPOS_DOCUMENTO" WHERE "CODIGO" = v_row."CLIENTE_TIPO_DOCUMENTO_CODIGO";

      v_id_genero := NULL;
      IF NULLIF(v_row."CLIENTE_GENERO_CODIGO", '') IS NOT NULL THEN
        SELECT "ID" INTO v_id_genero FROM "GENEROS" WHERE "CODIGO" = v_row."CLIENTE_GENERO_CODIGO";
      END IF;

      v_id_provincia := NULL;
      IF NULLIF(v_row."CLIENTE_PROVINCIA_CODIGO", '') IS NOT NULL THEN
        SELECT "ID" INTO v_id_provincia FROM "PROVINCIAS" WHERE "CODIGO" = v_row."CLIENTE_PROVINCIA_CODIGO";
      END IF;

      v_id_caracter := NULL;
      IF NULLIF(v_row."CLIENTE_CARACTER_CODIGO", '') IS NOT NULL THEN
        SELECT "ID" INTO v_id_caracter FROM "CARACTERES" WHERE "CODIGO" = v_row."CLIENTE_CARACTER_CODIGO";
      END IF;

      v_es_titular := NULL;
      IF NULLIF(v_row."CLIENTE_ES_TITULAR", '') IS NOT NULL THEN
        v_es_titular := lower(trim(v_row."CLIENTE_ES_TITULAR")) IN ('true', 'si', 'sí', '1');
      END IF;

      SELECT "ID" INTO v_id_cliente FROM "CLIENTES" WHERE "ID_TIPO_DOCUMENTO" = v_id_tipo_documento AND "NRO_DOCUMENTO" = v_row."CLIENTE_NRO_DOCUMENTO";

      IF v_id_cliente IS NULL THEN
        INSERT INTO "CLIENTES" (
          "ID_LEGAJO", "ID_CARACTER", "ES_TITULAR", "ID_TIPO_DOCUMENTO", "NRO_DOCUMENTO",
          "APELLIDO", "NOMBRE", "ID_GENERO", "ID_PROVINCIA", "ALTA_FECHA", "ALTA_USUARIO", "AUDIT_FECHA", "AUDIT_USUARIO"
        ) VALUES (
          v_id_legajo, v_id_caracter, COALESCE(v_es_titular, false), v_id_tipo_documento, v_row."CLIENTE_NRO_DOCUMENTO",
          NULLIF(v_row."CLIENTE_APELLIDO", ''), v_row."CLIENTE_NOMBRE", v_id_genero, v_id_provincia, now(), v_id_usuario_disparo, now(), v_id_usuario_disparo
        );
        v_clientes_creados := v_clientes_creados + 1;
      ELSE
        UPDATE "CLIENTES" SET
          "ID_LEGAJO" = COALESCE(v_id_legajo, "ID_LEGAJO"),
          "ID_CARACTER" = COALESCE(v_id_caracter, "ID_CARACTER"),
          "ES_TITULAR" = COALESCE(v_es_titular, "ES_TITULAR"),
          "APELLIDO" = COALESCE(NULLIF(v_row."CLIENTE_APELLIDO", ''), "APELLIDO"),
          "NOMBRE" = COALESCE(NULLIF(v_row."CLIENTE_NOMBRE", ''), "NOMBRE"),
          "ID_GENERO" = COALESCE(v_id_genero, "ID_GENERO"),
          "ID_PROVINCIA" = COALESCE(v_id_provincia, "ID_PROVINCIA"),
          "AUDIT_FECHA" = now(),
          "AUDIT_USUARIO" = v_id_usuario_disparo
        WHERE "ID" = v_id_cliente;
        v_clientes_actualizados := v_clientes_actualizados + 1;
      END IF;
    END LOOP;

    UPDATE "IMPORTADORES_EJECUCIONES"
    SET "RESUMEN_IMPACTO" = jsonb_build_object(
      'legajosCreados', v_legajos_creados,
      'legajosExistentes', v_legajos_existentes,
      'clientesCreados', v_clientes_creados,
      'clientesActualizados', v_clientes_actualizados,
      'filasSoloLegajo', v_filas_solo_legajo
    )
    WHERE "ID" = p_id_ejecucion;
  END IF;
END;
$$;
