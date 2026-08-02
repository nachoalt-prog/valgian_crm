-- Evalúa si una expresión cron estándar de 5 campos (minuto hora dia-mes mes
-- dia-semana) matchea un timestamp dado — no viene con Postgres ni con
-- pg_cron como función invocable (pg_cron solo la usa internamente para SUS
-- PROPIOS jobs, no la expone). Ver ADR 0015, domain/procesos.md.
--
-- Soporta: '*', número exacto, lista (a,b,c), rango (a-b), paso (*/n o a-b/n).
-- NO soporta: nombres de mes/día (JAN, MON), ni la regla POSIX de "día-mes OR
-- día-semana cuando ambos están restringidos" — los 5 campos se evalúan
-- siempre con AND. Suficiente para los horarios reales que necesita este
-- proyecto (diario/semanal/horario); si hace falta el caso POSIX completo,
-- se revisa entonces.
--
-- Día de la semana: acepta tanto 0 como 7 para domingo (convención cron
-- extendida) — EXTRACT(DOW) de Postgres solo devuelve 0-6, así que domingo se
-- valida contra el campo tanto en 0 como en 7.
CREATE OR REPLACE FUNCTION fn_cron_field_matches(p_espec text, p_valor integer, p_min integer, p_max integer)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_item text;
  v_base text;
  v_step integer;
  v_ini integer;
  v_fin integer;
BEGIN
  FOREACH v_item IN ARRAY string_to_array(p_espec, ',') LOOP
    v_step := 1;
    v_base := v_item;

    IF v_item LIKE '%/%' THEN
      v_base := split_part(v_item, '/', 1);
      v_step := split_part(v_item, '/', 2)::integer;
    END IF;

    IF v_base = '*' THEN
      v_ini := p_min;
      v_fin := p_max;
    ELSIF v_base LIKE '%-%' THEN
      v_ini := split_part(v_base, '-', 1)::integer;
      v_fin := split_part(v_base, '-', 2)::integer;
    ELSE
      v_ini := v_base::integer;
      v_fin := v_base::integer;
    END IF;

    IF p_valor >= v_ini AND p_valor <= v_fin AND MOD(p_valor - v_ini, v_step) = 0 THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION fn_cron_matches(p_cron text, p_ts timestamptz)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_campos text[];
  v_minuto integer;
  v_hora integer;
  v_dia integer;
  v_mes integer;
  v_dow integer;
BEGIN
  v_campos := regexp_split_to_array(trim(p_cron), '\s+');
  IF array_length(v_campos, 1) <> 5 THEN
    RAISE EXCEPTION 'Expresión cron inválida (se esperan 5 campos: minuto hora dia-mes mes dia-semana): %', p_cron;
  END IF;

  v_minuto := EXTRACT(MINUTE FROM p_ts)::integer;
  v_hora := EXTRACT(HOUR FROM p_ts)::integer;
  v_dia := EXTRACT(DAY FROM p_ts)::integer;
  v_mes := EXTRACT(MONTH FROM p_ts)::integer;
  v_dow := EXTRACT(DOW FROM p_ts)::integer; -- 0=domingo .. 6=sábado

  RETURN
    fn_cron_field_matches(v_campos[1], v_minuto, 0, 59) AND
    fn_cron_field_matches(v_campos[2], v_hora, 0, 23) AND
    fn_cron_field_matches(v_campos[3], v_dia, 1, 31) AND
    fn_cron_field_matches(v_campos[4], v_mes, 1, 12) AND
    (fn_cron_field_matches(v_campos[5], v_dow, 0, 7) OR (v_dow = 0 AND fn_cron_field_matches(v_campos[5], 7, 0, 7)));
END;
$$;
