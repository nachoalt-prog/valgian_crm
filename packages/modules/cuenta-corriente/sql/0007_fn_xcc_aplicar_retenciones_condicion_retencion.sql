-- Reemplaza la resolución de alícuota "por condición impositiva" de
-- 0002_fn_xcc_aplicar_retenciones.sql (CREATE OR REPLACE, no se edita el
-- archivo ya aplicado — mismo criterio que 0021_... en packages/db/sql).
--
-- Antes: XCC_CONDICIONES_IMPOSITIVAS.ALICUOTA_GANANCIAS era 1:1 con un único
-- tipo de retención ("Ganancias") — si hubiera existido un segundo tipo con
-- USA_CONDICION_IMPOSITIVA=true, habría leído exactamente el mismo número,
-- sin forma de diferenciarlo (ver docs/domain/cuenta-corriente.md).
--
-- Ahora: XCC_CONDICIONES_RETENCION (condición, tipo_retención) → alícuota es
-- el OVERRIDE explícito para ese par — que la fila exista ES el override. Si
-- no existe fila para el par, se usa XCC_TIPOS_RETENCION.ALICUOTA como
-- default (el mismo campo que ya se usaba como valor fijo cuando
-- USA_CONDICION_IMPOSITIVA=false). Soporta cualquier cantidad de tipos de
-- retención con el flag activo, cada uno resuelto independientemente.
CREATE OR REPLACE FUNCTION fn_xcc_aplicar_retenciones(
  p_id_cuenta uuid,
  p_id_cliente_titular uuid,
  p_dia date,
  p_interes_bruto double precision,
  INOUT p_saldo_capital double precision
) LANGUAGE plpgsql AS $$
DECLARE
  v_id_tipo_retencion_asiento uuid;
  v_ret RECORD;
  v_alicuota double precision;
  v_monto double precision;
BEGIN
  IF p_interes_bruto <= 0 THEN
    RETURN;
  END IF;

  SELECT "ID" INTO v_id_tipo_retencion_asiento FROM "XCC_TIPOS_MOVIMIENTOS" WHERE "CODIGO" = 'retencion';
  IF v_id_tipo_retencion_asiento IS NULL THEN
    RAISE EXCEPTION 'Falta el tipo de movimiento "retencion" en XCC_TIPOS_MOVIMIENTOS — correr el seed del módulo primero.';
  END IF;

  FOR v_ret IN SELECT * FROM "XCC_TIPOS_RETENCION" WHERE "ACTIVA" ORDER BY "ORDEN" LOOP
    IF v_ret."USA_CONDICION_IMPOSITIVA" THEN
      v_alicuota := NULL;
      IF p_id_cliente_titular IS NOT NULL THEN
        SELECT COALESCE(cr."ALICUOTA", v_ret."ALICUOTA") INTO v_alicuota
        FROM "XCC_CLIENTES_CONDICION_HISTORICO" ch
        LEFT JOIN "XCC_CONDICIONES_RETENCION" cr
          ON cr."ID_CONDICION_IMPOSITIVA" = ch."ID_CONDICION_IMPOSITIVA" AND cr."ID_TIPO_RETENCION" = v_ret."ID"
        WHERE ch."ID_CLIENTE" = p_id_cliente_titular AND ch."VIGENTE_DESDE"::date <= p_dia
        -- Desempate determinista si dos filas comparten VIGENTE_DESDE — mismo
        -- motivo que fn_xcc_tasa_vigente (0001_...), bug real encontrado con tests.
        ORDER BY ch."VIGENTE_DESDE" DESC, ch."ALTA_FECHA" DESC NULLS LAST, ch."ID" DESC LIMIT 1;
      END IF;
      v_alicuota := COALESCE(v_alicuota, 0);
    ELSE
      v_alicuota := COALESCE(v_ret."ALICUOTA", 0);
    END IF;

    v_monto := p_interes_bruto * v_alicuota / 100.0;
    IF v_monto > 0 THEN
      p_saldo_capital := p_saldo_capital - v_monto;
      INSERT INTO "XCC_SALDOS" ("ID_CUENTA", "FECHA", "ID_TIPO_MOVIMIENTO", "ID_TIPO_RETENCION", "CONCEPTO", "MONTO", "SALDO_CAPITAL", "SALDO_INTERES")
      VALUES (p_id_cuenta, p_dia, v_id_tipo_retencion_asiento, v_ret."ID", 'Retención ' || v_ret."NOMBRE", -v_monto, p_saldo_capital, 0);
    END IF;
  END LOOP;
END;
$$;
