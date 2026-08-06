-- Tasa efectiva de una cuenta a una fecha dada — la última fila de
-- XCC_CUENTAS_TASA_HISTORICO con VIGENTE_DESDE <= p_fecha. Necesario porque
-- el motor puede recalcular el pasado (ver docs/domain/cuenta-corriente.md): cada
-- día recalculado tiene que usar la tasa que regía ESE día, no la actual.
-- Devuelve 0 (no NULL) si la cuenta todavía no tiene ninguna tasa cargada,
-- para que el cálculo de interés que la multiplica dé 0 en vez de romper.
--
-- Desempate determinista (bug real encontrado con tests, ver docs/open-issues.md):
-- si DOS filas comparten el mismo VIGENTE_DESDE (ej. una corrección posterior
-- con la misma fecha de vigencia que la original), "ORDER BY VIGENTE_DESDE
-- DESC LIMIT 1" sin más no es determinístico — Postgres puede devolver
-- cualquiera de las dos. Se desempata por ALTA_FECHA (la corrección más
-- reciente gana) y por ID como último recurso si hasta eso empata.
CREATE OR REPLACE FUNCTION fn_xcc_tasa_vigente(p_id_cuenta uuid, p_fecha timestamptz) RETURNS double precision
LANGUAGE plpgsql AS $$
DECLARE
  v_tasa double precision;
BEGIN
  SELECT "TASA" INTO v_tasa
  FROM "XCC_CUENTAS_TASA_HISTORICO"
  WHERE "ID_CUENTA" = p_id_cuenta AND "VIGENTE_DESDE" <= p_fecha
  ORDER BY "VIGENTE_DESDE" DESC, "ALTA_FECHA" DESC NULLS LAST, "ID" DESC
  LIMIT 1;

  RETURN COALESCE(v_tasa, 0);
END;
$$;
