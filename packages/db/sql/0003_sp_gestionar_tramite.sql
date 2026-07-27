-- SP_GESTIONAR_TRAMITE: alta o edición de un trámite + aplicación de un estímulo,
-- en una única operación atómica. Ver domain/tramites.md.
--
-- p_id_tramite: UUID a usar. El llamador (packages/core) decide si es un ID
-- existente (edición) o uno recién generado (alta) — el procedure no lo genera,
-- así el mismo INSERT ... ON CONFLICT sirve para ambos casos sin lógica if/else.
--
-- p_datos: jsonb con la forma
--   [{"idTipoTramiteCampo": "uuid", "valorTexto": "...", "valorNumero": 1.5,
--     "valorFecha": "2026-01-01T00:00:00Z", "valorBooleano": true, "idArchivoAdjunto": "uuid"}, ...]
--   Cada elemento trae SOLO la columna de valor que corresponde a su tipo de
--   campo (las demás null) — esa resolución (qué columna usar según
--   TIPOS_CAMPOS.CODIGO) la hace packages/core, no este procedure.
--
-- Orden de operaciones (importante): el merge contra TRAMITES y
-- TRAMITES_CAMPOS_DATOS se comitea ANTES de llamar a sp_aplicar_estimulo, para
-- que los datos cargados por el usuario sobrevivan aunque el estímulo no sea
-- válido para el estado actual (validado empíricamente que un COMMIT dentro de
-- un procedure anidado vía CALL funciona sin problemas, a diferencia de una
-- función).
CREATE OR REPLACE PROCEDURE sp_gestionar_tramite(
  p_id_tramite uuid,
  p_id_tipo_tramite uuid,
  p_id_registro uuid,
  p_datos jsonb,
  p_id_estimulo uuid,
  p_id_usuario uuid,
  p_observacion text DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_entidad_tramites uuid;
  v_id_estrategia uuid;
  v_estado_inicial uuid;
  v_dato RECORD;
BEGIN
  SELECT "ID" INTO v_id_entidad_tramites FROM "ENTIDADES" WHERE "CODIGO" = 'tramites';
  IF v_id_entidad_tramites IS NULL THEN
    RAISE EXCEPTION 'No existe la entidad "tramites" en ENTIDADES';
  END IF;

  SELECT "ID_ESTRATEGIA" INTO v_id_estrategia FROM "TIPOS_TRAMITE" WHERE "ID" = p_id_tipo_tramite;
  IF v_id_estrategia IS NULL THEN
    RAISE EXCEPTION 'No existe el tipo de trámite % o no tiene estrategia asignada', p_id_tipo_tramite;
  END IF;

  -- Solo se usa si p_id_tramite todavía no existe (rama INSERT del upsert de
  -- abajo) — se calcula siempre igual, es una consulta barata.
  SELECT "ID" INTO v_estado_inicial FROM "ESTADOS" WHERE "ID_ESTRATEGIA" = v_id_estrategia AND "ES_INICIAL" = true;
  IF v_estado_inicial IS NULL THEN
    RAISE EXCEPTION 'La estrategia % no tiene un estado inicial configurado', v_id_estrategia;
  END IF;

  -- Todas las columnas de TRAMITES que setea este INSERT son "solo al crear":
  -- ID_TIPO_TRAMITE/ID_REGISTRO/ALTA_* quedan fijas para siempre una vez creado
  -- el trámite (igual que ES_INICIAL define el arranque pero no ata el resto
  -- del ciclo de vida) — por eso el conflicto no actualiza nada. ID_ESTADO y
  -- AUDIT_* los administra sp_aplicar_estimulo, nunca este merge. Esto también
  -- evita que un ID_REGISTRO "de relleno" (ej. al gestionar desde una bandeja
  -- genérica que no conoce el registro real de un trámite ya existente) pise
  -- el valor real.
  INSERT INTO "TRAMITES" ("ID", "ID_TIPO_TRAMITE", "ID_ESTADO", "ID_REGISTRO", "ALTA_FECHA", "ALTA_USUARIO")
  VALUES (p_id_tramite, p_id_tipo_tramite, v_estado_inicial, p_id_registro, now(), p_id_usuario)
  ON CONFLICT ("ID") DO NOTHING;

  FOR v_dato IN
    SELECT * FROM jsonb_to_recordset(p_datos) AS x(
      "idTipoTramiteCampo" uuid,
      "valorTexto" text,
      "valorNumero" double precision,
      "valorFecha" timestamptz,
      "valorBooleano" boolean,
      "idArchivoAdjunto" uuid
    )
  LOOP
    INSERT INTO "TRAMITES_CAMPOS_DATOS"
      ("ID_TRAMITE", "ID_TIPO_TRAMITE_CAMPO", "VALOR_TEXTO", "VALOR_NUMERO", "VALOR_FECHA", "VALOR_BOOLEANO", "ID_ARCHIVO_ADJUNTO")
    VALUES
      (p_id_tramite, v_dato."idTipoTramiteCampo", v_dato."valorTexto", v_dato."valorNumero", v_dato."valorFecha", v_dato."valorBooleano", v_dato."idArchivoAdjunto")
    ON CONFLICT ("ID_TRAMITE", "ID_TIPO_TRAMITE_CAMPO") DO UPDATE SET
      "VALOR_TEXTO" = EXCLUDED."VALOR_TEXTO",
      "VALOR_NUMERO" = EXCLUDED."VALOR_NUMERO",
      "VALOR_FECHA" = EXCLUDED."VALOR_FECHA",
      "VALOR_BOOLEANO" = EXCLUDED."VALOR_BOOLEANO",
      "ID_ARCHIVO_ADJUNTO" = EXCLUDED."ID_ARCHIVO_ADJUNTO";
  END LOOP;

  COMMIT;

  CALL sp_aplicar_estimulo(v_id_entidad_tramites, p_id_tramite, p_id_estimulo, p_id_usuario, p_observacion);
END;
$$;
