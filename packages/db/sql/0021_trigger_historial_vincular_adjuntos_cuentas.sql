-- Amplía fn_vincular_adjuntos_recientes_a_historial (0006_...) para que
-- también corra sobre movimientos de 'cuentas' (motor de estados de CUENTAS,
-- primer uso real: módulo Cuenta Corriente — ver domain/cuenta-corriente.md,
-- Gestión de cuenta). CREATE OR REPLACE alcanza — misma firma, solo cambia
-- la lista blanca de entidades del IF. Resto de la heurística sin cambios
-- (ventana de 10 minutos, "se lo lleva" el primer movimiento).
CREATE OR REPLACE FUNCTION fn_vincular_adjuntos_recientes_a_historial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_codigo_entidad text;
  v_id_entidad_historial uuid;
BEGIN
  SELECT "CODIGO" INTO v_codigo_entidad FROM "ENTIDADES" WHERE "ID" = NEW."ID_ENTIDAD";
  IF v_codigo_entidad NOT IN ('legajos', 'tramites', 'cuentas') THEN
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
