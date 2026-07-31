-- Auto-vincula a un movimiento de HISTORIAL los adjuntos recién subidos al
-- mismo legajo/trámite. Heurística deliberadamente acotada (ver
-- domain/motor-de-estados.md, sección "Adjuntos ↔ Historial"):
--   - Solo para movimientos de 'legajos' o 'tramites' (las únicas entidades
--     donde hoy tiene sentido "un archivo recién cargado es para esto").
--   - Solo adjuntos con ALTA_FECHA dentro de los últimos 10 minutos.
--   - Solo adjuntos que TODAVÍA no tengan ninguna asociación contra la
--     entidad 'historial' (en NINGÚN movimiento anterior, no solo este) — el
--     primer movimiento dentro de la ventana "se lleva" el archivo; una
--     segunda transición minutos después no se lo vuelve a llevar.
CREATE OR REPLACE FUNCTION fn_vincular_adjuntos_recientes_a_historial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_codigo_entidad text;
  v_id_entidad_historial uuid;
BEGIN
  SELECT "CODIGO" INTO v_codigo_entidad FROM "ENTIDADES" WHERE "ID" = NEW."ID_ENTIDAD";
  IF v_codigo_entidad IS DISTINCT FROM 'legajos' AND v_codigo_entidad IS DISTINCT FROM 'tramites' THEN
    RETURN NEW;
  END IF;

  SELECT "ID" INTO v_id_entidad_historial FROM "ENTIDADES" WHERE "CODIGO" = 'historial';
  IF v_id_entidad_historial IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO "ARCHIVOS_ADJUNTOS_ENTIDADES" ("ID_ARCHIVO_ADJUNTO", "ID_ENTIDAD", "ID_REGISTRO")
  SELECT aae."ID_ARCHIVO_ADJUNTO", v_id_entidad_historial, NEW."ID"
  FROM "ARCHIVOS_ADJUNTOS_ENTIDADES" aae
  JOIN "ARCHIVOS_ADJUNTOS" aa ON aa."ID" = aae."ID_ARCHIVO_ADJUNTO"
  WHERE aae."ID_ENTIDAD" = NEW."ID_ENTIDAD"
    AND aae."ID_REGISTRO" = NEW."ID_RELACION"
    AND aa."ALTA_FECHA" >= now() - interval '10 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM "ARCHIVOS_ADJUNTOS_ENTIDADES" ya
      WHERE ya."ID_ARCHIVO_ADJUNTO" = aae."ID_ARCHIVO_ADJUNTO"
        AND ya."ID_ENTIDAD" = v_id_entidad_historial
    )
  ON CONFLICT ("ID_ARCHIVO_ADJUNTO", "ID_ENTIDAD", "ID_REGISTRO") DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_historial_vincular_adjuntos ON "HISTORIAL";

CREATE TRIGGER trg_historial_vincular_adjuntos
AFTER INSERT ON "HISTORIAL"
FOR EACH ROW
EXECUTE FUNCTION fn_vincular_adjuntos_recientes_a_historial();
