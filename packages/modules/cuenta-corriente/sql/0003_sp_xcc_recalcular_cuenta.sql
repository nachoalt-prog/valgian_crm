-- Motor de cálculo de XCC — recalcula XCC_SALDOS de una cuenta desde una
-- fecha en adelante. Reemplaza el enfoque del legacy (cursor + REG_ORDEN
-- para detectar "qué cambió") por algo más simple: quien llama a esta
-- procedure YA sabe desde qué fecha hay que recalcular (es la fecha del
-- movimiento/tasa/checkpoint que acaba de entrar, encolada en
-- XCC_RECALCULO_PENDIENTE por 0004_trigger_xcc_recalcular.sql) — no hace
-- falta detectar nada.
--
-- PROCEDURE, no FUNCTION: es 100% base de datos — el único que la invoca es
-- sp_xcc_drenar_recalculos_pendientes (0005_...), vía CALL, nunca embebida
-- en un SELECT. No maneja su propia transacción (sin COMMIT/ROLLBACK) — el
-- recálculo de una cuenta es atómico, todo o nada, dentro de la transacción
-- de quien la llama.
--
-- Capital, devengamiento diario, acreditación mensual (día 1 de cada mes),
-- movimientos manuales, checkpoint, cierre, retenciones (Fase 3b — ver
-- fn_xcc_aplicar_retenciones, 0002_...).
--
-- Simplificación explícita respecto al legacy: los días inhábiles (fin de
-- semana/feriado) no generan un asiento de devengamiento propio — se cubren
-- de una sola vez en el próximo día hábil (mismo total de interés acumulado,
-- un solo tipo de asiento en vez de dos).
--
-- Decisión de diseño: los movimientos reales de un día se aplican al capital
-- ANTES de calcular el devengamiento de ESE MISMO día — un depósito de hoy
-- ya devenga interés hoy.
CREATE OR REPLACE PROCEDURE sp_xcc_recalcular_cuenta(p_id_cuenta uuid, p_desde timestamptz)
LANGUAGE plpgsql AS $$
DECLARE
  v_id_tipo_apertura uuid;
  v_id_tipo_devengamiento uuid;
  v_id_tipo_acreditacion uuid;
  v_id_tipo_cierre uuid;
  v_id_tipo_checkpoint uuid;
  v_orden_checkpoint integer;

  v_fecha_base date;
  v_saldo_capital double precision;
  v_saldo_interes double precision;
  v_fecha_ultimo_devengamiento date;

  v_alta_fecha date;
  v_esta_cerrada boolean;
  v_id_cliente_titular uuid;

  v_dia date;
  v_hoy date := CURRENT_DATE;

  v_mov RECORD;
  v_evento RECORD;
  v_dias integer;
  v_tasa double precision;
  v_monto double precision;
  v_interes_bruto double precision;
BEGIN
  SELECT "ID" INTO v_id_tipo_apertura FROM "XCC_TIPOS_MOVIMIENTOS" WHERE "CODIGO" = 'apertura';
  SELECT "ID" INTO v_id_tipo_devengamiento FROM "XCC_TIPOS_MOVIMIENTOS" WHERE "CODIGO" = 'devengamiento';
  SELECT "ID" INTO v_id_tipo_acreditacion FROM "XCC_TIPOS_MOVIMIENTOS" WHERE "CODIGO" = 'acreditacion_intereses';
  SELECT "ID" INTO v_id_tipo_cierre FROM "XCC_TIPOS_MOVIMIENTOS" WHERE "CODIGO" = 'cierre';
  SELECT "ID", "ORDEN" INTO v_id_tipo_checkpoint, v_orden_checkpoint FROM "XCC_TIPOS_MOVIMIENTOS" WHERE "CODIGO" = 'checkpoint';

  IF v_id_tipo_apertura IS NULL OR v_id_tipo_devengamiento IS NULL OR v_id_tipo_acreditacion IS NULL OR v_id_tipo_cierre IS NULL OR v_id_tipo_checkpoint IS NULL THEN
    RAISE EXCEPTION 'Faltan tipos de movimiento de motor en XCC_TIPOS_MOVIMIENTOS (apertura/devengamiento/acreditacion_intereses/cierre/checkpoint) — correr el seed del módulo primero.';
  END IF;

  SELECT c."ALTA_FECHA"::date, (e."CODIGO" = 'cerrada') INTO v_alta_fecha, v_esta_cerrada
  FROM "CUENTAS" c
  LEFT JOIN "ESTADOS" e ON e."ID" = c."ID_ESTADO"
  WHERE c."ID" = p_id_cuenta;

  IF v_alta_fecha IS NULL THEN
    RAISE EXCEPTION 'La cuenta % no existe o no tiene ALTA_FECHA', p_id_cuenta;
  END IF;

  -- Titular del legajo de la cuenta — se resuelve una sola vez acá, no en
  -- cada acreditación. El sistema garantiza (trigger) como máximo un
  -- ES_TITULAR=true por legajo; si no hay ninguno todavía, queda NULL y
  -- fn_xcc_aplicar_retenciones trata eso como alícuota 0 para Ganancias.
  SELECT cl."ID" INTO v_id_cliente_titular
  FROM "CUENTAS" c
  JOIN "CLIENTES" cl ON cl."ID_LEGAJO" = c."ID_LEGAJO" AND cl."ES_TITULAR"
  WHERE c."ID" = p_id_cuenta;

  -- Borra todo lo que haya que recalcular.
  DELETE FROM "XCC_SALDOS" WHERE "ID_CUENTA" = p_id_cuenta AND "FECHA" >= p_desde;

  -- Último punto conocido-bueno hasta p_desde inclusive (XCC_SALDOS o
  -- XCC_CHECKPOINT, el que sea más reciente). "<=" y no "<": un XCC_CHECKPOINT
  -- recién insertado con FECHA = p_desde (el caso normal, el trigger pasa
  -- NEW.FECHA como p_desde) tiene que poder usarse como base él mismo — si
  -- fuera "<" quedaría excluido por tener la misma fecha que el corte. Para
  -- XCC_SALDOS es inocuo: cualquier fila con FECHA = p_desde ya se borró en
  -- el DELETE de arriba, así que a esta altura nunca hay nada que encontrar ahí.
  -- Desempate determinista por ID si dos filas (una de XCC_SALDOS, otra de
  -- XCC_CHECKPOINT, o dos del mismo origen) comparten exactamente la misma
  -- FECHA — mismo motivo que los demás desempates de este archivo/módulo.
  SELECT x."FECHA"::date, x."SALDO_CAPITAL", x."SALDO_INTERES" INTO v_fecha_base, v_saldo_capital, v_saldo_interes
  FROM (
    SELECT "ID", "FECHA", "SALDO_CAPITAL", "SALDO_INTERES" FROM "XCC_SALDOS" WHERE "ID_CUENTA" = p_id_cuenta AND "FECHA" <= p_desde
    UNION ALL
    SELECT "ID", "FECHA", "SALDO_CAPITAL", "SALDO_INTERES" FROM "XCC_CHECKPOINT" WHERE "ID_CUENTA" = p_id_cuenta AND "FECHA" <= p_desde
  ) x
  ORDER BY x."FECHA" DESC, x."ID" DESC
  LIMIT 1;

  IF v_fecha_base IS NULL THEN
    -- Primera vez: arranca en la apertura de la cuenta.
    v_fecha_base := v_alta_fecha;
    v_saldo_capital := 0;
    v_saldo_interes := 0;

    IF NOT EXISTS (SELECT 1 FROM "XCC_SALDOS" WHERE "ID_CUENTA" = p_id_cuenta AND "ID_TIPO_MOVIMIENTO" = v_id_tipo_apertura) THEN
      INSERT INTO "XCC_SALDOS" ("ID_CUENTA", "FECHA", "ID_TIPO_MOVIMIENTO", "CONCEPTO", "MONTO", "SALDO_CAPITAL", "SALDO_INTERES")
      VALUES (p_id_cuenta, v_alta_fecha, v_id_tipo_apertura, 'Apertura de cuenta', 0, 0, 0);
    END IF;

    -- Bug corregido (ver docs/open-issues.md): el loop principal, más abajo,
    -- arranca en v_fecha_base + 1 — correcto cuando se retoma desde un
    -- XCC_SALDOS/XCC_CHECKPOINT previo (no hay que reprocesar ese punto), pero
    -- la primera vez eso también saltaba cualquier XCC_MOVIMIENTOS fechado el
    -- MISMO día que la apertura. Se aplican acá aparte, antes de que arranque
    -- el loop. Sin devengamiento propio ese día — es el punto de referencia
    -- (0 días transcurridos), igual que el legacy real (`@FechaAnt := @Fecha`
    -- en el primer registro procesado por el cursor de SP_XU_ACTUALIZAR_*).
    FOR v_mov IN
      SELECT m."ID", m."MONTO", m."FECHA", m."ID_TIPO_MOVIMIENTO", tm."SIGNO", tm."AFECTA_CAPITAL", tm."NOMBRE"
      FROM "XCC_MOVIMIENTOS" m
      JOIN "XCC_TIPOS_MOVIMIENTOS" tm ON tm."ID" = m."ID_TIPO_MOVIMIENTO"
      WHERE m."ID_CUENTA" = p_id_cuenta AND m."FECHA"::date = v_alta_fecha
      -- Desempate determinista si dos movimientos comparten la misma FECHA de
      -- negocio (bug real encontrado con tests: sin esto, el orden de
      -- aplicación al capital era no determinístico entre corridas — el TOTAL
      -- daba igual por ser suma conmutativa, pero el saldo INTERMEDIO de cada
      -- asiento individual podía variar de una recomputación a otra, algo
      -- inaceptable en un libro mayor). ALTA_FECHA = orden real de carga.
      ORDER BY m."FECHA", m."ALTA_FECHA" NULLS LAST, m."ID"
    LOOP
      IF v_mov."AFECTA_CAPITAL" THEN
        v_saldo_capital := v_saldo_capital + (v_mov."MONTO" * v_mov."SIGNO");
      END IF;
      INSERT INTO "XCC_SALDOS" ("ID_CUENTA", "FECHA", "ID_TIPO_MOVIMIENTO", "ID_XCC_MOVIMIENTO", "CONCEPTO", "MONTO", "SALDO_CAPITAL", "SALDO_INTERES")
      VALUES (p_id_cuenta, v_mov."FECHA", v_mov."ID_TIPO_MOVIMIENTO", v_mov."ID", v_mov."NOMBRE", v_mov."MONTO" * v_mov."SIGNO", v_saldo_capital, v_saldo_interes);
    END LOOP;
  END IF;

  v_fecha_ultimo_devengamiento := v_fecha_base;

  FOR v_dia IN SELECT generate_series(v_fecha_base + 1, v_hoy, interval '1 day')::date LOOP

    -- Acreditación: el día 1 de cada mes, capitaliza el interés acumulado del período anterior.
    -- Simplificación explícita: esto corre SIEMPRE primero si es día 1, incluso
    -- si más abajo hay un checkpoint ese mismo día. Si el checkpoint pisa
    -- SALDO_INTERES con un valor distinto, gana el checkpoint igual (se aplica
    -- después, ver el loop de eventos) — puede quedar un asiento de
    -- acreditación "de más" en el libro mayor en ese caso puntual (checkpoint
    -- justo el día 1, con interés pendiente), pero el saldo final es correcto.
    IF EXTRACT(DAY FROM v_dia) = 1 AND v_saldo_interes > 0 THEN
      v_interes_bruto := v_saldo_interes;
      v_saldo_capital := v_saldo_capital + v_saldo_interes;
      INSERT INTO "XCC_SALDOS" ("ID_CUENTA", "FECHA", "ID_TIPO_MOVIMIENTO", "CONCEPTO", "MONTO", "SALDO_CAPITAL", "SALDO_INTERES")
      VALUES (p_id_cuenta, v_dia, v_id_tipo_acreditacion, 'Acreditación de intereses', v_saldo_interes, v_saldo_capital, 0);
      v_saldo_interes := 0;
      v_saldo_capital := fn_xcc_aplicar_retenciones(p_id_cuenta, v_id_cliente_titular, v_dia, v_interes_bruto, v_saldo_capital);
    END IF;

    -- Checkpoints Y movimientos reales de este día, ordenados por TIPO
    -- primero (ORDEN de XCC_TIPOS_MOVIMIENTOS) y por FECHA real solo como
    -- desempate DENTRO del mismo tipo — verificado contra el legacy real
    -- (docs/runbooks/archivos de apoyo/procesos cuenta corriente.sql): el
    -- cursor principal ordena `ORDER BY FN_DATE_TO_CHAR(fecha,'YYYYMMDD'),
    -- TIPO, fecha` — TIPO manda dentro del día, la hora real solo desempata
    -- entre filas del MISMO tipo. La migración (TIPO 1102, `IF @Tipo = 1102
    -- ... SET @Capital = @SCapital ...`) va justo después de apertura (1101)
    -- y ANTES de devengamiento/movimientos/cierre — un snap incondicional al
    -- principio del día, sin importar a qué hora se cargó.
    --
    -- Bug real corregido en dos pasadas: primero (ver docs/open-issues.md
    -- histórico) el checkpoint se aplicaba SIEMPRE primero comparando solo
    -- FECHA::date. Una corrección posterior lo cambió a orden cronológico
    -- real (asumiendo que la hora del checkpoint importaba) — esa segunda
    -- corrección resultó estar MAL: no estaba verificada contra el legacy, y
    -- el legacy confirma que el checkpoint SIEMPRE va primero en su día por
    -- TIPO, representando "el saldo al INICIO de ese día", no "al momento
    -- exacto en que se cargó". Ahora se ordena por ORDEN (checkpoint=6,
    -- anterior a movimientos manuales=10-15), igual que el legacy.
    --
    -- Además, este loop es el único lugar (aparte del punto de partida, más
    -- arriba) que consulta XCC_CHECKPOINT — necesario porque un checkpoint
    -- puede quedar "tapado" en la cola por un pendiente más viejo (dedup de
    -- XCC_RECALCULO_PENDIENTE, caso típico: migrar una cuenta — se crea y,
    -- antes de que drene, se le carga el checkpoint con el saldo importado).
    FOR v_evento IN
      SELECT
        'checkpoint'::text AS tipo_evento,
        ck."ID" AS id_origen,
        ck."FECHA" AS fecha_real,
        ck."ALTA_FECHA" AS alta_fecha,
        v_orden_checkpoint AS orden_tipo,
        NULL::uuid AS id_tipo_movimiento,
        NULL::double precision AS monto,
        NULL::integer AS signo,
        NULL::boolean AS afecta_capital,
        NULL::text AS nombre,
        ck."SALDO_CAPITAL" AS checkpoint_capital,
        ck."SALDO_INTERES" AS checkpoint_interes
      FROM "XCC_CHECKPOINT" ck
      WHERE ck."ID_CUENTA" = p_id_cuenta AND ck."FECHA"::date = v_dia
      UNION ALL
      SELECT
        'movimiento'::text,
        m."ID",
        m."FECHA",
        m."ALTA_FECHA",
        tm."ORDEN",
        m."ID_TIPO_MOVIMIENTO",
        m."MONTO",
        tm."SIGNO",
        tm."AFECTA_CAPITAL",
        tm."NOMBRE",
        NULL::double precision,
        NULL::double precision
      FROM "XCC_MOVIMIENTOS" m
      JOIN "XCC_TIPOS_MOVIMIENTOS" tm ON tm."ID" = m."ID_TIPO_MOVIMIENTO"
      WHERE m."ID_CUENTA" = p_id_cuenta AND m."FECHA"::date = v_dia
      -- ORDEN del tipo manda; FECHA real, ALTA_FECHA e ID solo desempatan
      -- entre eventos del MISMO tipo (mismo criterio que el legacy).
      ORDER BY orden_tipo, fecha_real, alta_fecha NULLS LAST, id_origen
    LOOP
      IF v_evento.tipo_evento = 'checkpoint' THEN
        -- Autoritativo: pisa lo que se hubiera calculado hasta acá, sin
        -- devengamiento propio para el resto del día (nuevo punto de
        -- referencia — mismo criterio que el punto de partida de la función).
        v_saldo_capital := v_evento.checkpoint_capital;
        v_saldo_interes := COALESCE(v_evento.checkpoint_interes, 0);
        v_fecha_ultimo_devengamiento := v_dia;
        INSERT INTO "XCC_SALDOS" ("ID_CUENTA", "FECHA", "ID_TIPO_MOVIMIENTO", "CONCEPTO", "MONTO", "SALDO_CAPITAL", "SALDO_INTERES")
        VALUES (p_id_cuenta, v_evento.fecha_real, v_id_tipo_checkpoint, 'Checkpoint de saldo', 0, v_saldo_capital, v_saldo_interes);
      ELSE
        IF v_evento.afecta_capital THEN
          v_saldo_capital := v_saldo_capital + (v_evento.monto * v_evento.signo);
        END IF;
        INSERT INTO "XCC_SALDOS" ("ID_CUENTA", "FECHA", "ID_TIPO_MOVIMIENTO", "ID_XCC_MOVIMIENTO", "CONCEPTO", "MONTO", "SALDO_CAPITAL", "SALDO_INTERES")
        VALUES (p_id_cuenta, v_evento.fecha_real, v_evento.id_tipo_movimiento, v_evento.id_origen, v_evento.nombre, v_evento.monto * v_evento.signo, v_saldo_capital, v_saldo_interes);
      END IF;
    END LOOP;

    -- Devengamiento — solo días hábiles, cubriendo lo transcurrido desde el último asiento.
    -- fn_es_dia_habil es genérica del core (packages/db/sql/0020_...), no exclusiva de XCC.
    IF fn_es_dia_habil(v_dia) THEN
      v_dias := v_dia - v_fecha_ultimo_devengamiento;
      v_tasa := fn_xcc_tasa_vigente(p_id_cuenta, v_dia);
      v_monto := CASE WHEN v_saldo_capital <= 0 THEN 0 ELSE v_saldo_capital * v_tasa / 100.0 / 365.0 * v_dias END;
      v_saldo_interes := v_saldo_interes + v_monto;

      INSERT INTO "XCC_SALDOS" ("ID_CUENTA", "FECHA", "ID_TIPO_MOVIMIENTO", "CONCEPTO", "MONTO", "SALDO_CAPITAL", "SALDO_INTERES", "TASA_APLICADA")
      VALUES (p_id_cuenta, v_dia, v_id_tipo_devengamiento, 'Devengamiento de interés', v_monto, v_saldo_capital, v_saldo_interes, v_tasa);

      v_fecha_ultimo_devengamiento := v_dia;
    END IF;
  END LOOP;

  -- Cierre: si la cuenta está cerrada y todavía no se generó el asiento de cierre.
  IF v_esta_cerrada AND NOT EXISTS (SELECT 1 FROM "XCC_SALDOS" WHERE "ID_CUENTA" = p_id_cuenta AND "ID_TIPO_MOVIMIENTO" = v_id_tipo_cierre) THEN
    IF v_saldo_interes > 0 THEN
      v_interes_bruto := v_saldo_interes;
      v_saldo_capital := v_saldo_capital + v_saldo_interes;
      INSERT INTO "XCC_SALDOS" ("ID_CUENTA", "FECHA", "ID_TIPO_MOVIMIENTO", "CONCEPTO", "MONTO", "SALDO_CAPITAL", "SALDO_INTERES")
      VALUES (p_id_cuenta, v_hoy, v_id_tipo_acreditacion, 'Acreditación de intereses (cierre)', v_saldo_interes, v_saldo_capital, 0);
      v_saldo_interes := 0;
      v_saldo_capital := fn_xcc_aplicar_retenciones(p_id_cuenta, v_id_cliente_titular, v_hoy, v_interes_bruto, v_saldo_capital);
    END IF;
    INSERT INTO "XCC_SALDOS" ("ID_CUENTA", "FECHA", "ID_TIPO_MOVIMIENTO", "CONCEPTO", "MONTO", "SALDO_CAPITAL", "SALDO_INTERES")
    VALUES (p_id_cuenta, v_hoy, v_id_tipo_cierre, 'Cierre de cuenta', 0, v_saldo_capital, 0);
  END IF;
END;
$$;
