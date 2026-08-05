-- Día hábil = ni sábado/domingo ni fila en FERIADOS. Genérico — cualquier
-- módulo o pieza del core que necesite noción de "día hábil" la consulta
-- (nació para el devengamiento de interés del módulo Cuenta Corriente, ver
-- docs/módulo XCC, pero FERIADOS/TIPOS_FERIADO son tablas del core, no
-- exclusivas de ese módulo — ver domain/core.md). Trata CUALQUIER fila de
-- FERIADOS como no-hábil, sin distinguir por TIPOS_FERIADO (inamovible/
-- trasladable/no laborable/turístico) — simplificación explícita, documentada.
CREATE OR REPLACE FUNCTION fn_es_dia_habil(p_fecha date) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXTRACT(DOW FROM p_fecha) NOT IN (0, 6)
    AND NOT EXISTS (SELECT 1 FROM "FERIADOS" WHERE "FECHA" = p_fecha);
END;
$$;
