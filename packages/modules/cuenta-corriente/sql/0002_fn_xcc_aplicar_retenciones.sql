-- Aplica las retenciones activas sobre un interés bruto ya acreditado —
-- invocada desde sp_xcc_recalcular_cuenta (0003_...) en sus dos puntos de
-- acreditación (capitalización mensual y cierre de cuenta), nunca duplicada
-- entre ambos (ver docs/domain/cuenta-corriente.md — principios de diseño
-- contra "dos copias que divergen").
--
-- Verificado contra el legacy real (docs/runbooks/archivos de apoyo/procesos
-- cuenta corriente.sql): cada retención se calcula sobre el interés BRUTO,
-- sin cascada — `@ITF = @ITF + @Interes * 0.006` y
-- `@RetIIGG = @RetIIGG + dbo.FN_XU_RETENCION(@EstaCuenta, @FechaAnt, @Fecha, @Interes, 'IIGG')`
-- usan ambas `@Interes` directo, nunca un acumulador ya descontado por otra
-- retención. Por eso p_interes_bruto es fijo para todo el loop, no se
-- recalcula entre retenciones.
--
-- XCC_TIPOS_RETENCION.USA_CONDICION_IMPOSITIVA distingue "alícuota fija"
-- (ej. ITF, usa TIPOS_RETENCION.ALICUOTA directo) de "depende de la condición
-- impositiva del cliente" (Ganancias, resuelve XCC_CLIENTES_CONDICION_HISTORICO
-- → XCC_CONDICIONES_IMPOSITIVAS.ALICUOTA_GANANCIAS) como DATO, no comparando
-- CODIGO en este código — checklist sección 0 contra números mágicos.
--
-- Si el cliente titular no tiene condición impositiva cargada a la fecha del
-- asiento (o la cuenta no tiene titular todavía), la alícuota resuelve 0 —
-- no rompe el recálculo de toda la cuenta por un dato faltante, mismo
-- espíritu que "una instalación sin retenciones simplemente no tiene filas
-- activas, el motor sigue funcionando igual".
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
        SELECT ci."ALICUOTA_GANANCIAS" INTO v_alicuota
        FROM "XCC_CLIENTES_CONDICION_HISTORICO" ch
        JOIN "XCC_CONDICIONES_IMPOSITIVAS" ci ON ci."ID" = ch."ID_CONDICION_IMPOSITIVA"
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
