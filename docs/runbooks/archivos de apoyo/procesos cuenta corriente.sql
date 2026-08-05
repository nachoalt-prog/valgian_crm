SP_XU_ACTUALIZAR_1CA_MENS CREATE PROCEDURE SP_XU_ACTUALIZAR_1CA_MENS(@IdCSP INT, @Debug INT = NULL) AS BEGIN DECLARE @RegOrdenEsperado INT,
@Hoy INT,
@Ayer INT,
@REG_ORDEN INT,
@ID_XU_ACTUALIZACION_SALDO INT
/*Cursor para recorrer todos los registros y buscar los "cambios" (saltos en la numeracion de reg_orden)*/
DECLARE CURSOR_CAMBIOS CURSOR FOR
SELECT
	ID_XU_ACTUALIZACION_SALDO,
	COALESCE(REG_ORDEN, -2) AS REG_ORDEN
FROM
	XU_ACTUALIZACION_SALDOS
WHERE
	ID_CARPETA_SUB_PRODUCTO = @IdCSP
ORDER BY
	dbo.FN_DATE_TO_CHAR(FECHA, 'YYYYMMDD'),
	TIPO;

/*****************************************************************
 * Referencia:
 * -----------
 *     1101 Apertura
 *     1201 DEVENGAMIENTO INTERESES INHABILES
 * ------------ MOVIMIENTOS-CIERRE-MENSUAL ----------------------
 *     1211 ACREDITACION INTERESES
 *     1212 RET. DE IMP.A LAS GCIAS.POR INTERES ACREDITADOS
 *     1213 RET. DE ITF POR INTERES ACREDITADOS
 *     1214 DEVENGAMIENTO INTERESES
 * --------------------------------------------------------------
 *     1401 TRANSF.DE CTA.PROPIA-RECIBIDA-CCR
 *     1402 TRANSF.FONDOS A OTRA CTA.PROPIA -EMITIDA-CCR
 *     1411 EMBARGOS
 *     1412 DEVOLUCIÓN DE EMBARGOS
 *     1421 Ajuste sobre Capital
 *     1422 Ajuste sobre Intereses Devengados
 * ------------ MOVIMIENTOS-CIERRE-CUENTA -----------------------
 *     1601 DEVENGAMIENTO INTERESES
 *     1610 ACREDITACION INTERESES
 *     1611 RET. DE IMP.A LAS GCIAS.POR INTERES ACREDITADOS
 *     1612 RET. DE ITF POR INTERES ACREDITADOS
 *     1702 TRANSF.FONDOS A OTRA CTA.PROPIA -EMITIDA-CCR
 *     1730 CIERRE DE CUENTA
 *****************************************************************/
/* Obtener la fecha Hoy y de Ayer en ADVTIME */
SET
	@Hoy = dbo.hoy();

SET
	@Ayer = (dbo.hoy() -86400);

/* Genero la APERTURA de la Cuenta */
INSERT INTO
	XU_ACTUALIZACION_SALDOS (
		ID_CARPETA_SUB_PRODUCTO,
		ID_XU_CSP,
		FECHA,
		CONCEPTO,
		TIPO,
		COTIZACION,
		TASA_DIARIA,
		MONTO,
		S_CAPITAL,
		S_INTERES,
		S_RET_IIGG,
		S_ITF,
		S_EMBARGO,
		REG_ORDEN,
		PROCESADO,
		ID_XC_DOCUMENTO,
		COD_MEDIO,
		COD_ORIGEN,
		COD_SUCURSAL,
		COD_CANAL,
		AUX
	)
SELECT
	CSP.ID_CARPETA_SUB_PRODUCTO AS ID_CARPETA_SUB_PRODUCTO,
	XUCSP.ID_XU_CSP AS ID_XU_CSP,
	XUCSP.FECHA_APERTURA AS FECHA,
	'APERTURA DE CUENTA' AS CONCEPTO,
	1101 AS TIPO,
CASE
		WHEN MH.COTIZACION IS NOT NULL THEN MH.COTIZACION
		ELSE M.COTIZACION
	END COTIZACION,
	dbo.FN_XU_OBTENER_TASA(CSP.ID_CARPETA_SUB_PRODUCTO, XUCSP.FECHA_APERTURA) AS TASA_DIARIA,
	0 AS MONTO,
	0 AS S_CAPITAL,
	0 AS S_INTERES,
	0 AS S_RET_IIGG,
	0 AS S_ITF,
	0 AS S_EMBARGO,
	NULL AS REG_ORDEN,
	NULL AS PROCESADO,
	NULL AS ID_XC_DOCUMENTO,
	NULL AS COD_MEDIO,
	NULL AS COD_ORIGEN,
	NULL AS COD_SUCURSAL,
	NULL AS COD_CANAL,
	NULL AS AUX
FROM
	CARPETA_SUB_PRODUCTOS CSP
	INNER JOIN XU_CSP XUCSP ON XUCSP.ID_CARPETA_SUB_PRODUCTO = CSP.ID_CARPETA_SUB_PRODUCTO
	INNER JOIN MONEDAS M ON M.ID_MONEDA = CSP.ID_MONEDA
	LEFT JOIN MONEDAS_HISTORICO MH ON MH.ID_MONEDA = M.ID_MONEDA
	AND XUCSP.FECHA_APERTURA < MH.FECHA_MODIFICACION
	AND NOT EXISTS (
		SELECT
			*
		FROM
			MONEDAS_HISTORICO MHX
		WHERE
			MHX.FECHA_MODIFICACION < MH.FECHA_MODIFICACION
			AND MHX.FECHA_MODIFICACION > XUCSP.FECHA_APERTURA
			AND MHX.ID_MONEDA = MH.ID_MONEDA
	)
WHERE
	CSP.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	AND NOT EXISTS (
		SELECT
			*
		FROM
			XU_ACTUALIZACION_SALDOS XAS
		WHERE
			XAS.TIPO = 1101
			AND XAS.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	);

/* Genero el CIERRE de la Cuenta */
INSERT INTO
	XU_ACTUALIZACION_SALDOS (
		ID_CARPETA_SUB_PRODUCTO,
		ID_XU_CSP,
		FECHA,
		CONCEPTO,
		TIPO,
		COTIZACION,
		TASA_DIARIA,
		MONTO,
		S_CAPITAL,
		S_INTERES,
		S_RET_IIGG,
		S_ITF,
		S_EMBARGO,
		REG_ORDEN,
		PROCESADO,
		ID_XC_DOCUMENTO,
		COD_MEDIO,
		COD_ORIGEN,
		COD_SUCURSAL,
		COD_CANAL,
		AUX
	)
SELECT
	CSP.ID_CARPETA_SUB_PRODUCTO AS ID_CARPETA_SUB_PRODUCTO,
	XUCSP.ID_XU_CSP AS ID_XU_CSP,
	dbo.FN_CHAR_TO_DATE(
		dbo.FN_DATE_TO_CHAR(XUCSP.FECHA_CIERRE, 'DD/MM/YYYY'),
		'DD/MM/YYYY'
	) + 86398 AS FECHA,
	'CIERRE DE CUENTA' AS CONCEPTO,
	1730 AS TIPO,
CASE
		WHEN MH.COTIZACION IS NOT NULL THEN MH.COTIZACION
		ELSE M.COTIZACION
	END COTIZACION,
	dbo.FN_XU_OBTENER_TASA(CSP.ID_CARPETA_SUB_PRODUCTO, XUCSP.FECHA_CIERRE) AS TASA_DIARIA,
	0 AS MONTO,
	0 AS S_CAPITAL,
	0 AS S_INTERES,
	0 AS S_RET_IIGG,
	0 AS S_ITF,
	0 AS S_EMBARGO,
	NULL AS REG_ORDEN,
	NULL AS PROCESADO,
	NULL AS ID_XC_DOCUMENTO,
	NULL AS COD_MEDIO,
	NULL AS COD_ORIGEN,
	NULL AS COD_SUCURSAL,
	NULL AS COD_CANAL,
	NULL AS AUX
FROM
	CARPETA_SUB_PRODUCTOS CSP
	INNER JOIN XU_CSP XUCSP ON XUCSP.ID_CARPETA_SUB_PRODUCTO = CSP.ID_CARPETA_SUB_PRODUCTO
	INNER JOIN MONEDAS M ON M.ID_MONEDA = CSP.ID_MONEDA
	LEFT JOIN MONEDAS_HISTORICO MH ON MH.ID_MONEDA = M.ID_MONEDA
	AND XUCSP.FECHA_CIERRE < MH.FECHA_MODIFICACION
	AND NOT EXISTS (
		SELECT
			*
		FROM
			MONEDAS_HISTORICO MHX
		WHERE
			MHX.FECHA_MODIFICACION < MH.FECHA_MODIFICACION
			AND MHX.FECHA_MODIFICACION > XUCSP.FECHA_CIERRE
			AND MHX.ID_MONEDA = MH.ID_MONEDA
	)
WHERE
	CSP.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	and XUCSP.FECHA_CIERRE is not null
	AND NOT EXISTS (
		SELECT
			*
		FROM
			XU_ACTUALIZACION_SALDOS XAS
		WHERE
			XAS.TIPO = 1730
			AND XAS.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	);

/* Cargo TODOS los movimientos que aún no se han cargado */
INSERT INTO
	XU_ACTUALIZACION_SALDOS (
		ID_CARPETA_SUB_PRODUCTO,
		ID_XU_CSP,
		FECHA,
		CONCEPTO,
		TIPO,
		COTIZACION,
		TASA_DIARIA,
		MONTO,
		S_CAPITAL,
		S_INTERES,
		S_RET_IIGG,
		S_ITF,
		S_EMBARGO,
		REG_ORDEN,
		PROCESADO,
		ID_XC_DOCUMENTO,
		COD_MEDIO,
		COD_ORIGEN,
		COD_SUCURSAL,
		COD_CANAL,
		AUX
	)
SELECT
	XUCSP.ID_CARPETA_SUB_PRODUCTO AS ID_CARPETA_SUB_PRODUCTO,
	XUCSP.ID_XU_CSP AS ID_XU_CSP,
	MOV.FECHA AS FECHA,
	UPPER(TMOV.NOMBRE) +case
		when MOV.NRO_RECIBO is null then ' '
		else ' [' + MOV.NRO_RECIBO + ']'
	end AS CONCEPTO,
	TMOV.PARAM1 AS TIPO,
CASE
		WHEN MH.COTIZACION IS NOT NULL THEN MH.COTIZACION
		ELSE M.COTIZACION
	END AS COTIZACION,
	dbo.FN_XU_OBTENER_TASA(XUCSP.ID_CARPETA_SUB_PRODUCTO, MOV.FECHA) AS TASA_DIARIA,
	MOV.MONTO AS MONTO,
	0 AS S_CAPITAL,
	0 AS S_INTERES,
	0 AS S_RET_IIGG,
	0 AS S_ITF,
	0 AS S_EMBARGO,
	NULL AS REG_ORDEN,
	NULL AS PROCESADO,
	NULL AS ID_XC_DOCUMENTO,
	NULL AS COD_MEDIO,
	MOV.COD_ORIGEN,
	MOV.COD_SUCURSAL,
	MOV.COD_CANAL,
	MOV.ID_XU_MOVIMIENTO AS AUX
FROM
	XU_TIPOS_MOVIMIENTOS TMOV,
	XU_CSP XUCSP,
	XU_MOVIMIENTOS MOV
	INNER JOIN MONEDAS M ON MOV.ID_MONEDA = M.ID_MONEDA
	LEFT JOIN MONEDAS_HISTORICO MH ON MH.ID_MONEDA = M.ID_MONEDA
	AND MOV.FECHA < MH.FECHA_MODIFICACION
	AND NOT EXISTS (
		SELECT
			*
		FROM
			MONEDAS_HISTORICO MHX
		WHERE
			MHX.FECHA_MODIFICACION < MH.FECHA_MODIFICACION
			AND MHX.FECHA_MODIFICACION > MOV.FECHA
			AND MHX.ID_MONEDA = MH.ID_MONEDA
	)
WHERE
	TMOV.ID_XU_TIPO_MOVIMIENTO = MOV.ID_XU_TIPO_MOVIMIENTO
	AND MOV.ID_XU_CSP = XUCSP.ID_XU_CSP
	AND XUCSP.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	AND NOT EXISTS (
		SELECT
			*
		FROM
			XU_ACTUALIZACION_SALDOS XAS
		WHERE
			XAS.AUX = MOV.ID_XU_MOVIMIENTO
			AND XAS.TIPO = TMOV.PARAM1
			AND XAS.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	)
ORDER BY
	MOV.ID_XU_MOVIMIENTO;

/* Genero los registros de DEVENGAMIENTO de INTERESES que faltan */
INSERT INTO
	XU_ACTUALIZACION_SALDOS (
		ID_CARPETA_SUB_PRODUCTO,
		ID_XU_CSP,
		FECHA,
		CONCEPTO,
		TIPO,
		COTIZACION,
		TASA_DIARIA,
		MONTO,
		S_CAPITAL,
		S_INTERES,
		S_RET_IIGG,
		S_ITF,
		S_EMBARGO,
		REG_ORDEN,
		PROCESADO,
		ID_XC_DOCUMENTO,
		COD_MEDIO,
		COD_ORIGEN,
		COD_SUCURSAL,
		COD_CANAL,
		AUX
	)
SELECT
	CSP.ID_CARPETA_SUB_PRODUCTO AS ID_CARPETA_SUB_PRODUCTO,
	XUCSP.ID_XU_CSP AS ID_XU_CSP,
	XD.FECHA_ADVTIME + 86399 AS FECHA,
	'DEV. INT.' AS CONCEPTO,
	1214 AS TIPO,
CASE
		WHEN MH.COTIZACION IS NOT NULL THEN MH.COTIZACION
		ELSE M.COTIZACION
	END AS COTIZACION,
	DBO.FN_XU_OBTENER_TASA(CSP.ID_CARPETA_SUB_PRODUCTO, XD.FECHA_ADVTIME) AS TASA_DIARIA,
	0 AS MONTO,
	0 AS S_CAPITAL,
	0 AS S_INTERES,
	0 AS S_RET_IIGG,
	0 AS S_ITF,
	0 AS S_EMBARGO,
	NULL AS REG_ORDEN,
	NULL AS PROCESADO,
	NULL AS ID_XC_DOCUMENTO,
	NULL AS COD_MEDIO,
	NULL AS COD_ORIGEN,
	NULL AS COD_SUCURSAL,
	NULL AS COD_CANAL,
	NULL AS AUX
FROM
	XDIAS XD,
	CARPETA_SUB_PRODUCTOS CSP
	INNER JOIN XU_CSP XUCSP ON XUCSP.ID_CARPETA_SUB_PRODUCTO = CSP.ID_CARPETA_SUB_PRODUCTO
	INNER JOIN MONEDAS M ON M.ID_MONEDA = CSP.ID_MONEDA
	LEFT JOIN MONEDAS_HISTORICO MH ON MH.ID_MONEDA = M.ID_MONEDA
	AND XUCSP.FECHA_APERTURA < MH.FECHA_MODIFICACION
	AND NOT EXISTS (
		SELECT
			*
		FROM
			MONEDAS_HISTORICO MHX
		WHERE
			MHX.FECHA_MODIFICACION < MH.FECHA_MODIFICACION
			AND MHX.FECHA_MODIFICACION > XUCSP.FECHA_APERTURA
			AND MHX.ID_MONEDA = MH.ID_MONEDA
	)
WHERE
	/* PARA TODOS LOS DÍAS HÁBILES HASTA AYER... */
	DBO.FN_XU_ES_DIA_HABIL(XD.FECHA_ADVTIME, NULL) = 1
	and XD.FECHA_ADVTIME BETWEEN COALESCE(XUCSP.FECHA_APERTURA, @Ayer)
	AND COALESCE(XUCSP.FECHA_CIERRE, @Ayer)
	/* No debe ser devengamiento por cierre de cuenta */
	AND XD.FECHA_ADVTIME < COALESCE(XUCSP.FECHA_CIERRE,(dbo.ahora() + 86400))
	/* ... Correspondiente a la Cuenta en proceso... */
	AND XUCSP.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	AND NOT EXISTS (
		SELECT
			*
		FROM
			XU_ACTUALIZACION_SALDOS XAS
		WHERE
			XAS.TIPO = 1214
			AND dbo.FN_DATE_TO_CHAR(XAS.FECHA, 'DD/MM/YYYY') = dbo.FN_DATE_TO_CHAR(XD.FECHA_ADVTIME, 'DD/MM/YYYY')
			AND XAS.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	);

/* Genero los registros de DEVENGAMIENTO de INTERESES de días inhabiles que faltan */
INSERT INTO
	XU_ACTUALIZACION_SALDOS (
		ID_CARPETA_SUB_PRODUCTO,
		ID_XU_CSP,
		FECHA,
		CONCEPTO,
		TIPO,
		COTIZACION,
		TASA_DIARIA,
		MONTO,
		S_CAPITAL,
		S_INTERES,
		S_RET_IIGG,
		S_ITF,
		S_EMBARGO,
		REG_ORDEN,
		PROCESADO,
		ID_XC_DOCUMENTO,
		COD_MEDIO,
		COD_ORIGEN,
		COD_SUCURSAL,
		COD_CANAL,
		AUX
	)
SELECT
	CSP.ID_CARPETA_SUB_PRODUCTO AS ID_CARPETA_SUB_PRODUCTO,
	XUCSP.ID_XU_CSP AS ID_XU_CSP,
	XD.FECHA_ADVTIME AS FECHA,
	'DEV. INT.' AS CONCEPTO,
	1201 AS TIPO,
CASE
		WHEN MH.COTIZACION IS NOT NULL THEN MH.COTIZACION
		ELSE M.COTIZACION
	END AS COTIZACION,
	dbo.FN_XU_OBTENER_TASA(
		CSP.ID_CARPETA_SUB_PRODUCTO,
		dbo.FN_XU_ULTIMO_DIA_HABIL(XD.FECHA_ADVTIME)
	) AS TASA_DIARIA,
	0 AS MONTO,
	0 AS S_CAPITAL,
	0 AS S_INTERES,
	0 AS S_RET_IIGG,
	0 AS S_ITF,
	0 AS S_EMBARGO,
	NULL AS REG_ORDEN,
	NULL AS PROCESADO,
	NULL AS ID_XC_DOCUMENTO,
	NULL AS COD_MEDIO,
	NULL AS COD_ORIGEN,
	NULL AS COD_SUCURSAL,
	NULL AS COD_CANAL,
	NULL AS AUX
FROM
	XDIAS XD,
	CARPETA_SUB_PRODUCTOS CSP
	INNER JOIN XU_CSP XUCSP ON XUCSP.ID_CARPETA_SUB_PRODUCTO = CSP.ID_CARPETA_SUB_PRODUCTO
	INNER JOIN MONEDAS M ON M.ID_MONEDA = CSP.ID_MONEDA
	LEFT JOIN MONEDAS_HISTORICO MH ON MH.ID_MONEDA = M.ID_MONEDA
	AND XUCSP.FECHA_APERTURA < MH.FECHA_MODIFICACION
	AND NOT EXISTS (
		SELECT
			*
		FROM
			MONEDAS_HISTORICO MHX
		WHERE
			MHX.FECHA_MODIFICACION < MH.FECHA_MODIFICACION
			AND MHX.FECHA_MODIFICACION > XUCSP.FECHA_APERTURA
			AND MHX.ID_MONEDA = MH.ID_MONEDA
	)
WHERE
	/* PARA TODOS LOS DÍAS HÁBILES HASTA HOY QUE TIENEN UN DÍA INHABIL ANTES... */
	DBO.FN_XU_ES_DIA_HABIL(
		dbo.fn_char_to_date(XD.FECHA_TEXTO, 'DD/MM/YYYY'),
		NULL
	) = 1
	AND DBO.FN_XU_ES_DIA_HABIL(
		dbo.fn_char_to_date(XD.FECHA_TEXTO, 'DD/MM/YYYY') -86000,
		NULL
	) = 0
	and XD.FECHA_ADVTIME BETWEEN coalesce(XUCSP.FECHA_APERTURA, @Hoy)
	AND coalesce(XUCSP.FECHA_CIERRE, @Hoy)
	/* ... Correspondiente a la Cuenta en proceso... */
	AND XUCSP.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	/* ... No se aperturo un Lunes ... */
	AND XUCSP.FECHA_APERTURA <> (XD.FECHA_ADVTIME + 86399)
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	AND NOT EXISTS (
		SELECT
			*
		FROM
			XU_ACTUALIZACION_SALDOS XAS
		WHERE
			XAS.TIPO = 1201
			AND XAS.FECHA = XD.FECHA_ADVTIME
			AND XAS.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	);

/**************************** MOVIMIENTOS DE FIN DE MES ***************************************************/
/* Genero los registros de ACREDITACION de INTERESES de fin de mes que faltan */
INSERT INTO
	XU_ACTUALIZACION_SALDOS (
		ID_CARPETA_SUB_PRODUCTO,
		ID_XU_CSP,
		FECHA,
		CONCEPTO,
		TIPO,
		COTIZACION,
		TASA_DIARIA,
		MONTO,
		S_CAPITAL,
		S_INTERES,
		S_RET_IIGG,
		S_ITF,
		S_EMBARGO,
		REG_ORDEN,
		PROCESADO,
		ID_XC_DOCUMENTO,
		COD_MEDIO,
		COD_ORIGEN,
		COD_SUCURSAL,
		COD_CANAL,
		AUX
	)
SELECT
	CSP.ID_CARPETA_SUB_PRODUCTO AS ID_CARPETA_SUB_PRODUCTO,
	XUCSP.ID_XU_CSP AS ID_XU_CSP,
	XD.FECHA_ADVTIME + 86399 AS FECHA,
	'ACREDITACIÓN DE INTERESES' AS CONCEPTO,
	1211 AS TIPO,
CASE
		WHEN MH.COTIZACION IS NOT NULL THEN MH.COTIZACION
		ELSE M.COTIZACION
	END AS COTIZACION,
	DBO.FN_XU_OBTENER_TASA(CSP.ID_CARPETA_SUB_PRODUCTO, XD.FECHA_ADVTIME) AS TASA_DIARIA,
	0 AS MONTO,
	0 AS S_CAPITAL,
	0 AS S_INTERES,
	0 AS S_RET_IIGG,
	0 AS S_ITF,
	0 AS S_EMBARGO,
	NULL AS REG_ORDEN,
	NULL AS PROCESADO,
	NULL AS ID_XC_DOCUMENTO,
	NULL AS COD_MEDIO,
	NULL AS COD_ORIGEN,
	NULL AS COD_SUCURSAL,
	NULL AS COD_CANAL,
	NULL AS AUX
FROM
	XDIAS XD,
	CARPETA_SUB_PRODUCTOS CSP
	INNER JOIN XU_CSP XUCSP ON XUCSP.ID_CARPETA_SUB_PRODUCTO = CSP.ID_CARPETA_SUB_PRODUCTO
	INNER JOIN MONEDAS M ON M.ID_MONEDA = CSP.ID_MONEDA
	LEFT JOIN MONEDAS_HISTORICO MH ON MH.ID_MONEDA = M.ID_MONEDA
	AND XUCSP.FECHA_APERTURA < MH.FECHA_MODIFICACION
	AND NOT EXISTS (
		SELECT
			*
		FROM
			MONEDAS_HISTORICO MHX
		WHERE
			MHX.FECHA_MODIFICACION < MH.FECHA_MODIFICACION
			AND MHX.FECHA_MODIFICACION > XUCSP.FECHA_APERTURA
			AND MHX.ID_MONEDA = MH.ID_MONEDA
	)
WHERE
	/* PARA TODOS LOS DÍAS 1 DE CADA MES HASTA AYER... */
	XD.FECHA_TEXTO LIKE '01/%'
	and XD.FECHA_ADVTIME BETWEEN coalesce(XUCSP.FECHA_APERTURA, @Ayer)
	AND coalesce(XUCSP.FECHA_CIERRE, @Ayer)
	/* ... Correspondiente a la Cuenta en proceso... */
	AND XUCSP.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	AND NOT EXISTS (
		SELECT
			*
		FROM
			XU_ACTUALIZACION_SALDOS XAS
		WHERE
			XAS.TIPO = 1211
			AND XAS.FECHA = XD.FECHA_ADVTIME + 86399
			AND XAS.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	);

/* Argrego un registro de Devengamieno de Interés por cada registro de Acreditación de cierre de mensual(tengo que devengar hasta el día de acreditación) */
INSERT INTO
	XU_ACTUALIZACION_SALDOS (
		ID_CARPETA_SUB_PRODUCTO,
		ID_XU_CSP,
		FECHA,
		CONCEPTO,
		TIPO,
		COTIZACION,
		TASA_DIARIA,
		MONTO,
		S_CAPITAL,
		S_INTERES,
		S_RET_IIGG,
		S_ITF,
		S_EMBARGO,
		REG_ORDEN,
		PROCESADO,
		ID_XC_DOCUMENTO,
		COD_MEDIO,
		COD_ORIGEN,
		COD_SUCURSAL,
		COD_CANAL,
		AUX
	)
SELECT
	ID_CARPETA_SUB_PRODUCTO,
	ID_XU_CSP,
	FECHA,
	'DEV. INT.' AS CONCEPTO,
	1214 AS TIPO,
	COTIZACION,
	TASA_DIARIA,
	0 AS MONTO,
	0 AS S_CAPITAL,
	0 AS S_INTERES,
	0 AS S_RET_IIGG,
	0 AS S_ITF,
	0 AS S_EMBARGO,
	NULL AS REG_ORDEN,
	NULL AS PROCESADO,
	NULL AS ID_XC_DOCUMENTO,
	NULL AS COD_MEDIO,
	NULL AS COD_ORIGEN,
	NULL AS COD_SUCURSAL,
	NULL AS COD_CANAL,
	NULL AS AUX
FROM
	XU_ACTUALIZACION_SALDOS A
WHERE
	/* POR CADA CIERRE DE CUENTA... */
	A.TIPO = 1211
	/* ... CORRESPONDIENTE A LA CUENTA EN PROCESO... */
	AND A.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	AND dbo.FN_XU_ES_DIA_HABIL(FECHA, null) = 1
	/* ... SI YA NO HAY OTRO REGISTRO DE ESTE TIPO PARA ESTA FECHA */
	AND NOT EXISTS (
		SELECT
			*
		FROM
			XU_ACTUALIZACION_SALDOS XAS
		WHERE
			XAS.TIPO = 1214
			AND XAS.FECHA = A.FECHA
			AND XAS.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	);

/* Agrego los registros de devengamiento de días inhabiles por cada acreditacion de cierre de mensual*/
INSERT INTO
	XU_ACTUALIZACION_SALDOS (
		ID_CARPETA_SUB_PRODUCTO,
		ID_XU_CSP,
		FECHA,
		CONCEPTO,
		TIPO,
		COTIZACION,
		TASA_DIARIA,
		MONTO,
		S_CAPITAL,
		S_INTERES,
		S_RET_IIGG,
		S_ITF,
		S_EMBARGO,
		REG_ORDEN,
		PROCESADO,
		ID_XC_DOCUMENTO,
		COD_MEDIO,
		COD_ORIGEN,
		COD_SUCURSAL,
		COD_CANAL,
		AUX
	)
SELECT
	ID_CARPETA_SUB_PRODUCTO,
	ID_XU_CSP,
	FECHA,
	'DEV. INT.' AS CONCEPTO,
	1201 AS TIPO,
	COTIZACION,
	dbo.FN_XU_OBTENER_TASA(
		A.ID_CARPETA_SUB_PRODUCTO,
		dbo.FN_XU_ULTIMO_DIA_HABIL(FECHA)
	) AS TASA_DIARIA,
	0 AS MONTO,
	0 AS S_CAPITAL,
	0 AS S_INTERES,
	0 AS S_RET_IIGG,
	0 AS S_ITF,
	0 AS S_EMBARGO,
	NULL AS REG_ORDEN,
	NULL AS PROCESADO,
	NULL AS ID_XC_DOCUMENTO,
	NULL AS COD_MEDIO,
	NULL AS COD_ORIGEN,
	NULL AS COD_SUCURSAL,
	NULL AS COD_CANAL,
	NULL AS AUX
FROM
	XU_ACTUALIZACION_SALDOS A
WHERE
	/* POR CADA CIERRE DE CUENTA... */
	A.TIPO = 1211
	/* AL MENOS AYER FUE DÍA INHABIL */
	AND dbo.FN_XU_ES_DIA_HABIL(FECHA -86400, null) = 0
	/* ... CORRESPONDIENTE A LA CUENTA EN PROCESO... */
	AND A.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	AND NOT EXISTS (
		SELECT
			*
		FROM
			XU_ACTUALIZACION_SALDOS XAS
		WHERE
			XAS.TIPO = 1201
			AND XAS.FECHA = A.FECHA
			AND XAS.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	);

/**************************** MOVIMIENTOS CIERRE DE CUENTA ***************************************************/
/* Agrego un Registro de Acreditación por cada evento de cierre */
INSERT INTO
	XU_ACTUALIZACION_SALDOS (
		ID_CARPETA_SUB_PRODUCTO,
		ID_XU_CSP,
		FECHA,
		CONCEPTO,
		TIPO,
		COTIZACION,
		TASA_DIARIA,
		MONTO,
		S_CAPITAL,
		S_INTERES,
		S_RET_IIGG,
		S_ITF,
		S_EMBARGO,
		REG_ORDEN,
		PROCESADO,
		ID_XC_DOCUMENTO,
		COD_MEDIO,
		COD_ORIGEN,
		COD_SUCURSAL,
		COD_CANAL,
		AUX
	)
SELECT
	ID_CARPETA_SUB_PRODUCTO,
	ID_XU_CSP,
	FECHA,
	'ACREDITACIÓN DE INTERESES' AS CONCEPTO,
	1610 AS TIPO,
	COTIZACION,
	TASA_DIARIA,
	0 AS MONTO,
	0 AS S_CAPITAL,
	0 AS S_INTERES,
	0 AS S_RET_IIGG,
	0 AS S_ITF,
	0 AS S_EMBARGO,
	NULL AS REG_ORDEN,
	NULL AS PROCESADO,
	NULL AS ID_XC_DOCUMENTO,
	NULL AS COD_MEDIO,
	NULL AS COD_ORIGEN,
	NULL AS COD_SUCURSAL,
	NULL AS COD_CANAL,
	NULL AS AUX
FROM
	XU_ACTUALIZACION_SALDOS A
WHERE
	/* POR CADA CIERRE DE CUENTA... */
	A.TIPO = 1730
	/* ... CORRESPONDIENTE A LA CUENTA EN PROCESO... */
	AND A.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	AND NOT EXISTS (
		SELECT
			*
		FROM
			XU_ACTUALIZACION_SALDOS XAS
		WHERE
			XAS.TIPO = 1610
			AND XAS.FECHA = A.FECHA
			AND XAS.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	);

/* Agrego un Registro de Extracción Final por cada evento de cierre */
INSERT INTO
	XU_ACTUALIZACION_SALDOS (
		ID_CARPETA_SUB_PRODUCTO,
		ID_XU_CSP,
		FECHA,
		CONCEPTO,
		TIPO,
		COTIZACION,
		TASA_DIARIA,
		MONTO,
		S_CAPITAL,
		S_INTERES,
		S_RET_IIGG,
		S_ITF,
		S_EMBARGO,
		REG_ORDEN,
		PROCESADO,
		ID_XC_DOCUMENTO,
		COD_MEDIO,
		COD_ORIGEN,
		COD_SUCURSAL,
		COD_CANAL,
		AUX
	)
SELECT
	ID_CARPETA_SUB_PRODUCTO,
	ID_XU_CSP,
	FECHA,
	'EXTRACCIÓN POR CIERRE DE CTA' AS CONCEPTO,
	1702 AS TIPO,
	COTIZACION,
	TASA_DIARIA,
	0 AS MONTO,
	0 AS S_CAPITAL,
	0 AS S_INTERES,
	0 AS S_RET_IIGG,
	0 AS S_ITF,
	0 AS S_EMBARGO,
	NULL AS REG_ORDEN,
	NULL AS PROCESADO,
	NULL AS ID_XC_DOCUMENTO,
	NULL AS COD_MEDIO,
	NULL AS COD_ORIGEN,
	NULL AS COD_SUCURSAL,
	NULL AS COD_CANAL,
	NULL AS AUX
FROM
	XU_ACTUALIZACION_SALDOS A
WHERE
	/* POR CADA CIERRE DE CUENTA... */
	A.TIPO = 1730
	/* ... CORRESPONDIENTE A LA CUENTA EN PROCESO... */
	AND A.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	AND NOT EXISTS (
		SELECT
			*
		FROM
			XU_ACTUALIZACION_SALDOS XAS
		WHERE
			XAS.TIPO = 1702
			AND XAS.FECHA = A.FECHA
			AND XAS.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	);

/* Argrego un registro de Devengamieno de Interés por cada registro de Acreditación de cierre de cuenta(tengo que devengar hasta el día de acreditación) */
INSERT INTO
	XU_ACTUALIZACION_SALDOS (
		ID_CARPETA_SUB_PRODUCTO,
		ID_XU_CSP,
		FECHA,
		CONCEPTO,
		TIPO,
		COTIZACION,
		TASA_DIARIA,
		MONTO,
		S_CAPITAL,
		S_INTERES,
		S_RET_IIGG,
		S_ITF,
		S_EMBARGO,
		REG_ORDEN,
		PROCESADO,
		ID_XC_DOCUMENTO,
		COD_MEDIO,
		COD_ORIGEN,
		COD_SUCURSAL,
		COD_CANAL,
		AUX
	)
SELECT
	ID_CARPETA_SUB_PRODUCTO,
	ID_XU_CSP,
	FECHA,
	'DEV. INT.' AS CONCEPTO,
	1601 AS TIPO,
	COTIZACION,
	TASA_DIARIA,
	0 AS MONTO,
	0 AS S_CAPITAL,
	0 AS S_INTERES,
	0 AS S_RET_IIGG,
	0 AS S_ITF,
	0 AS S_EMBARGO,
	NULL AS REG_ORDEN,
	NULL AS PROCESADO,
	NULL AS ID_XC_DOCUMENTO,
	NULL AS COD_MEDIO,
	NULL AS COD_ORIGEN,
	NULL AS COD_SUCURSAL,
	NULL AS COD_CANAL,
	NULL AS AUX
FROM
	XU_ACTUALIZACION_SALDOS A
WHERE
	/* POR CADA CIERRE DE CUENTA... */
	A.TIPO = 1610
	/* ... CORRESPONDIENTE A LA CUENTA EN PROCESO... */
	AND A.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	/* ... SI YA NO HAY OTRO REGISTRO DE ESTE TIPO PARA ESTA FECHA */
	AND NOT EXISTS (
		SELECT
			*
		FROM
			XU_ACTUALIZACION_SALDOS XAS
		WHERE
			XAS.TIPO = 1601
			AND XAS.FECHA = A.FECHA
			AND XAS.ID_CARPETA_SUB_PRODUCTO = @IdCSP
	);

/* Actualizo la cotizacion */
MERGE INTO XU_ACTUALIZACION_SALDOS AA USING (
	SELECT
		A.ID_XU_ACTUALIZACION_SALDO,
CASE
			WHEN MH.COTIZACION IS NOT NULL THEN MH.COTIZACION
			ELSE M.COTIZACION
		END AS COTIZACION
	FROM
		XU_ACTUALIZACION_SALDOS A
		INNER JOIN CARPETA_SUB_PRODUCTOS CSP ON A.ID_CARPETA_SUB_PRODUCTO = CSP.ID_CARPETA_SUB_PRODUCTO
		INNER JOIN MONEDAS M ON M.ID_MONEDA = CSP.ID_MONEDA
		LEFT JOIN MONEDAS_HISTORICO MH ON MH.ID_MONEDA = M.ID_MONEDA
		AND A.FECHA < MH.FECHA_MODIFICACION
		AND NOT EXISTS (
			SELECT
				*
			FROM
				MONEDAS_HISTORICO MHX
			WHERE
				MHX.FECHA_MODIFICACION < MH.FECHA_MODIFICACION
				AND A.FECHA < MHX.FECHA_MODIFICACION
				AND MHX.ID_MONEDA = MH.ID_MONEDA
		)
	WHERE
		A.COTIZACION IS NULL
		AND A.ID_CARPETA_SUB_PRODUCTO = @IdCSP
) AB ON (
	AA.ID_XU_ACTUALIZACION_SALDO = AB.ID_XU_ACTUALIZACION_SALDO
)
WHEN MATCHED THEN
UPDATE
SET
	COTIZACION = AB.COTIZACION;

/* Actualizo la tasa */
UPDATE
	XU_ACTUALIZACION_SALDOS
SET
	TASA_DIARIA = DBO.FN_XU_OBTENER_TASA(ID_CARPETA_SUB_PRODUCTO, FECHA)
WHERE
	TASA_DIARIA IS NULL
	AND ID_CARPETA_SUB_PRODUCTO = @IdCSP;

SET
	@RegOrdenEsperado = 1;

/* Abro el cursor */
OPEN CURSOR_CAMBIOS
/* Tomo el primer registro */
FETCH NEXT
FROM
	CURSOR_CAMBIOS INTO @ID_XU_ACTUALIZACION_SALDO,
	@REG_ORDEN
	/*Checkeo si hubo cambios: Registros eliminados, Registros agregados en el medio, etc.*/
	WHILE @ @FETCH_STATUS = 0 BEGIN
	/* Si el REG_ORDEN no es el que esperaba (hay un salto), marco el registro como cambiado para ser reprocesado */
	IF (@REG_ORDEN <> @RegOrdenEsperado) BEGIN
UPDATE
	XU_ACTUALIZACION_SALDOS
SET
	REG_ORDEN = NULL,
	PROCESADO = NULL
WHERE
	ID_XU_ACTUALIZACION_SALDO = @ID_XU_ACTUALIZACION_SALDO;

/* Todos los subsiguientes van a ser actualizados. Espero un REG_ORDEN imposible para lograr Ã©sto*/
SET
	@RegOrdenEsperado = -1;

END
ELSE BEGIN
/*si es el que  esperaba, aumento en 1 la variable.*/
SET
	@RegOrdenEsperado = @RegOrdenEsperado + 1;

END FETCH NEXT
FROM
	CURSOR_CAMBIOS INTO @ID_XU_ACTUALIZACION_SALDO,
	@REG_ORDEN
END;

/* Cierro y Desaloco el Cursor */
CLOSE CURSOR_CAMBIOS DEALLOCATE CURSOR_CAMBIOS
/* Ejecuto los inversos de contabilidad para todos los registros que tenían documento pero deben ser reprocesados */
--exec dbo.SP_XU_INVERSOS
/* Computo los saldos para completar la actualizacion de la deuda */
EXEC SP_XU_COMPUTAR_1CCR_MENS @IdCSP,
@Debug
END;

SP_XU_ACTUALIZAR_1CCR_MENS CREATE PROCEDURE SP_XU_ACTUALIZAR_1CCR_MENS (
	@IdCSP int,
	@Debug int = NULL
) AS BEGIN DECLARE @RegOrdenEsperado int,
@Hoy int,
@Ayer int,
@ID_XU_ACTUALIZACION_SALDO int,
@REG_ORDEN int
/*Cursor para recorrer todos los registros y buscar los "cambios" (saltos en la numeracion de reg_orden)*/
DECLARE CURSOR_CAMBIOS CURSOR FOR
select
	id_xu_actualizacion_saldo,
	coalesce(reg_orden, -2) as reg_orden
from
	xu_actualizacion_saldos
where
	id_carpeta_sub_producto = @IdCSP
order by
	dbo.FN_DATE_TO_CHAR(fecha, 'YYYYMMDD'),
	tipo,
	fecha;

/*****************************************************************
 * Referencia:
 * ----------------- MOVIMIENTOS-DE INICIO ----------------------
 *     1101 Apertura
 *     1102 Registro por Migracion
 *     1201 DEVENGAMIENTO INTERESES INHABILES
 *     1215 DEVENGAMIENTO INTERESES (Deprecated)
 * ------------ MOVIMIENTOS-CIERRE-MENSUAL ----------------------
 *     1211 ACREDITACION INTERESES
 *     1212 RET. DE IMP.A LAS GCIAS.POR INTERES ACREDITADOS
 *     1213 RET. DE ITF POR INTERES ACREDITADOS
 *     1214 RET. DE IIBB POR INTERES ACREDITADOS
 * ------------ MOVIMIENTOS-DE-OPERACION-DIARIA -----------------
 *     1401 TRANSF.DE CTA.PROPIA-RECIBIDA-CCR
 *     1402 TRANSF.FONDOS A OTRA CTA.PROPIA -EMITIDA-CCR
 *     1403 TRANSF.DE CTA.TERCERO-RECIBIDA-CCR    (Gravado ITF e IIBB)
 *     1404 TRANSF.FONDOS A CTA.TERCERO -EMITIDA-CCR (Gravado ITF)
 *     1411 EMBARGOS
 *     1412 DEVOLUCIÓN DE EMBARGOS
 *     1421 Ajuste sobre Capital
 *     1422 Ajuste sobre Intereses Devengados
 *     1501 RET. DE ITF POR TRANSF.DE/A CTA.TERCEROS
 *     1502 RET. DE IIBB POR TRANSF.DE/A CTA.TERCEROS
 * ------------ MOVIMIENTOS-CIERRE-CUENTA -----------------------
 *     1601 DEVENGAMIENTO INTERESES
 *     1610 ACREDITACION INTERESES
 *     1611 RET. DE IMP.A LAS GCIAS.POR INTERES ACREDITADOS
 *     1612 RET. DE ITF POR INTERES ACREDITADOS
 *     1613 RET. DE IIBB POR INTERES ACREDITADOS
 *     1702 TRANSF.FONDOS A OTRA CTA.PROPIA -EMITIDA-CCR
 *     1730 CIERRE DE CUENTA
 * ------------ MOVIMIENTOS-DE-CIERRE-DIARIO --------------------
 *     1801 DEVENGAMIENTO INTERESES INHABILES  (ex 1201) (Deprecated)
 *     1815 DEVENGAMIENTO INTERESES (ex 1215)
 *****************************************************************/
/* Obtener la fecha Hoy y de Ayer en ADVTIME */
SET
	@Hoy = dbo.HOY();

SET
	@Ayer = (dbo.HOY() -86400);

BEGIN TRANSACTION
/* Genero la APERTURA de la Cuenta */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	csp.id_carpeta_sub_producto as id_carpeta_sub_producto,
	xucsp.id_xu_csp as id_xu_csp,
	xucsp.fecha_apertura as fecha,
	'APERTURA DE CUENTA' as concepto,
	1101 as tipo,
	case
		when mh.cotizacion is not null then mh.cotizacion
		else m.cotizacion
	end cotizacion,
	dbo.FN_XU_OBTENER_TASA(csp.id_carpeta_sub_producto, xucsp.fecha_apertura) as tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	carpeta_sub_productos csp
	inner join xu_csp xucsp on xucsp.id_carpeta_sub_producto = csp.id_carpeta_sub_producto
	inner join monedas m on m.id_moneda = csp.id_moneda
	left join monedas_historico mh on mh.id_moneda = m.id_moneda
	and xucsp.fecha_apertura < mh.fecha_modificacion
	and not exists (
		select
			*
		from
			monedas_historico mhx
		where
			mhx.fecha_modificacion < mh.fecha_modificacion
			and mhx.fecha_modificacion > xucsp.fecha_apertura
			and mhx.id_moneda = mh.id_moneda
	)
where
	csp.id_carpeta_sub_producto = @IdCSP
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1101
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Genero el CIERRE de la Cuenta */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	csp.id_carpeta_sub_producto as id_carpeta_sub_producto,
	xucsp.id_xu_csp as id_xu_csp,
	dbo.FN_CHAR_TO_DATE(
		dbo.fn_date_to_char(xucsp.fecha_cierre, 'DD/MM/YYYY'),
		'DD/MM/YYYY'
	) + 86398 as fecha,
	'CIERRE DE CUENTA' as concepto,
	1730 as tipo,
	case
		when mh.cotizacion is not null then mh.cotizacion
		else m.cotizacion
	end cotizacion,
	dbo.FN_XU_OBTENER_TASA(csp.id_carpeta_sub_producto, xucsp.fecha_cierre) as tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	carpeta_sub_productos csp
	inner join xu_csp xucsp on xucsp.id_carpeta_sub_producto = csp.id_carpeta_sub_producto
	inner join monedas m on m.id_moneda = csp.id_moneda
	left join monedas_historico mh on mh.id_moneda = m.id_moneda
	and xucsp.fecha_cierre < mh.fecha_modificacion
	and not exists (
		select
			*
		from
			monedas_historico mhx
		where
			mhx.fecha_modificacion < mh.fecha_modificacion
			and mhx.fecha_modificacion > xucsp.fecha_cierre
			and mhx.id_moneda = mh.id_moneda
	)
where
	csp.id_carpeta_sub_producto = @IdCSP
	and xucsp.fecha_cierre is not null
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1730
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Cargo TODOS los movimientos que aún no se han cargado
 Incluye tipos 1401, 1402 (cta propia) y los nuevos 1403, 1404 (cta tercero).
 El filtro by tipo lo hace xu_tipos_movimientos.param1, no hay que cambiarlo aquí */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	xucsp.id_carpeta_sub_producto as id_carpeta_sub_producto,
	xucsp.id_xu_csp as id_xu_csp,
	mov.fecha as fecha,
	upper(tmov.nombre) + case
		when mov.nro_recibo is null then ' '
		else ' [' + mov.nro_recibo + ']'
	end as concepto,
	tmov.param1 as tipo,
	case
		when mh.cotizacion is not null then mh.cotizacion
		else m.cotizacion
	end as cotizacion,
	dbo.fn_xu_obtener_tasa(xucsp.id_carpeta_sub_producto, mov.fecha) as tasa_diaria,
	mov.monto as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	mov.cod_origen,
	mov.cod_sucursal,
	mov.cod_canal,
	mov.id_xu_movimiento as aux
from
	xu_tipos_movimientos tmov,
	xu_csp xucsp,
	xu_movimientos mov
	inner join monedas m on mov.id_moneda = m.id_moneda
	left join monedas_historico mh on mh.id_moneda = m.id_moneda
	and mov.fecha < mh.fecha_modificacion
	and not exists (
		select
			*
		from
			monedas_historico mhx
		where
			mhx.fecha_modificacion < mh.fecha_modificacion
			and mhx.fecha_modificacion > mov.fecha
			and mhx.id_moneda = mh.id_moneda
	)
where
	tmov.id_xu_tipo_movimiento = mov.id_xu_tipo_movimiento
	and mov.id_xu_csp = xucsp.id_xu_csp
	and xucsp.id_carpeta_sub_producto = @IdCSP
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.aux = mov.id_xu_movimiento
			and xas.tipo = tmov.param1
			and xas.id_carpeta_sub_producto = @IdCSP
	)
order by
	mov.id_xu_movimiento;

/* Genero los registros de ACREDITACION de INTERESES de fin de mes que faltan */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	csp.id_carpeta_sub_producto as id_carpeta_sub_producto,
	xucsp.id_xu_csp as id_xu_csp,
	xd.fecha_advtime + 86399 as fecha,
	'ACREDITACIÓN DE INTERESES' as concepto,
	1211 as tipo,
	case
		when mh.cotizacion is not null then mh.cotizacion
		else m.cotizacion
	end as cotizacion,
	dbo.FN_XU_OBTENER_TASA(csp.id_carpeta_sub_producto, xd.fecha_advtime) as tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xdias xd,
	carpeta_sub_productos csp
	inner join xu_csp xucsp on xucsp.id_carpeta_sub_producto = csp.id_carpeta_sub_producto
	inner join monedas m on m.id_moneda = csp.id_moneda
	left join monedas_historico mh on mh.id_moneda = m.id_moneda
	and xucsp.fecha_apertura < mh.fecha_modificacion
	and not exists (
		select
			*
		from
			monedas_historico mhx
		where
			mhx.fecha_modificacion < mh.fecha_modificacion
			and mhx.fecha_modificacion > xucsp.fecha_apertura
			and mhx.id_moneda = mh.id_moneda
	)
where
	/* para todos los días 1 de cada mes hasta ayer... */
	xd.fecha_texto like '01/%'
	and xd.fecha_advtime between coalesce(xucsp.fecha_apertura, @Hoy)
	and coalesce(xucsp.fecha_cierre, @Hoy)
	/* ... correspondiente a la cuenta en proceso... */
	and xucsp.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1211
			and xas.fecha = xd.fecha_advtime + 86399
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Agrego los registros de Retenciones de IIBB por cada acreditacion de cierre mensual*/
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	id_carpeta_sub_producto,
	id_xu_csp,
	fecha,
	'ret. de iibb.' as concepto,
	1214 as tipo,
	cotizacion,
	tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	/* por cada cierre de mes... */
	a.tipo = 1211
	/* ... correspondiente a la cuenta en proceso... */
	and a.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1214
			and xas.fecha = a.fecha
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Genero los registros de DEVENGAMIENTO de INTERESES que faltan */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	csp.id_carpeta_sub_producto as id_carpeta_sub_producto,
	xucsp.id_xu_csp as id_xu_csp,
	xd.fecha_advtime + 86399 as fecha,
	'DEV. INT.' as concepto,
	1815 as tipo,
	case
		when mh.cotizacion is not null then mh.cotizacion
		else m.cotizacion
	end as cotizacion,
	dbo.FN_XU_OBTENER_TASA(csp.id_carpeta_sub_producto, xd.fecha_advtime) as tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xdias xd,
	carpeta_sub_productos csp
	inner join xu_csp xucsp on xucsp.id_carpeta_sub_producto = csp.id_carpeta_sub_producto
	inner join monedas m on m.id_moneda = csp.id_moneda
	left join monedas_historico mh on mh.id_moneda = m.id_moneda
	and xucsp.fecha_apertura < mh.fecha_modificacion
	and not exists (
		select
			*
		from
			monedas_historico mhx
		where
			mhx.fecha_modificacion < mh.fecha_modificacion
			and mhx.fecha_modificacion > xucsp.fecha_apertura
			and mhx.id_moneda = mh.id_moneda
	)
where
	/* para todos los días hábiles hasta ayer... */
	dbo.FN_XU_ES_DIA_HABIL(xd.fecha_advtime, null) = 1
	and xd.fecha_advtime between coalesce(xucsp.fecha_apertura, @Ayer)
	and coalesce(xucsp.fecha_cierre, @Ayer)
	/* no debe ser devengamiento por cierre de cuenta */
	and xd.fecha_advtime < coalesce(xucsp.fecha_cierre,(dbo.ahora() + 86400))
	/* ... correspondiente a la cuenta en proceso... */
	and xucsp.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo in (1215, 1815)
			and xas.fecha between xd.fecha_advtime
			and xd.fecha_advtime + 86399
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Genero los registros de DEVENGAMIENTO de INTERESES de días inhabiles que faltan */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	csp.id_carpeta_sub_producto as id_carpeta_sub_producto,
	xucsp.id_xu_csp as id_xu_csp,
	xd.fecha_advtime as fecha,
	'DEV. INT.' as concepto,
	1201 as tipo,
	case
		when mh.cotizacion is not null then mh.cotizacion
		else m.cotizacion
	end as cotizacion,
	dbo.FN_XU_OBTENER_TASA(
		csp.id_carpeta_sub_producto,
		dbo.FN_XU_ULTIMO_DIA_HABIL(xd.fecha_advtime)
	) as tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xdias xd,
	carpeta_sub_productos csp
	inner join xu_csp xucsp on xucsp.id_carpeta_sub_producto = csp.id_carpeta_sub_producto
	inner join monedas m on m.id_moneda = csp.id_moneda
	left join monedas_historico mh on mh.id_moneda = m.id_moneda
	and xucsp.fecha_apertura < mh.fecha_modificacion
	and not exists (
		select
			*
		from
			monedas_historico mhx
		where
			mhx.fecha_modificacion < mh.fecha_modificacion
			and mhx.fecha_modificacion > xucsp.fecha_apertura
			and mhx.id_moneda = mh.id_moneda
	)
where
	/* para todos los días hábiles hasta hoy que tienen un día inhabil antes... */
	dbo.FN_XU_ES_DIA_HABIL(xd.fecha_advtime, null) = 1
	and dbo.FN_XU_ES_DIA_HABIL(xd.fecha_advtime -86000, null) = 0
	and xd.fecha_advtime between coalesce(xucsp.fecha_apertura, @Hoy)
	and coalesce(xucsp.fecha_cierre, @Hoy)
	/* ... correspondiente a la cuenta en proceso... */
	and xucsp.id_carpeta_sub_producto = @IdCSP
	/* ... no se aperturo un lunes ... */
	and xucsp.fecha_apertura <> (xd.fecha_advtime + 86399)
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo in (1201, 1801)
			and xas.fecha between xd.fecha_advtime
			and xd.fecha_advtime + 86399
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/**************************** MOVIMIENTOS DE FIN DE MES ***************************************************/
/* Argrego un registro de Devengamieno de Interés por cada registro de Acreditación de cierre de mensual(tengo que devengar hasta el día de acreditación) (DEPRECATED)*/
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	id_carpeta_sub_producto,
	id_xu_csp,
	fecha,
	'DEV. INT.' as concepto,
	1815 as tipo,
	cotizacion,
	tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	/* por cada cierre de cuenta... */
	a.tipo = 1211
	and 1 = 0 --DEPRECATED
	/* ... correspondiente a la cuenta en proceso... */
	and a.id_carpeta_sub_producto = @IdCSP
	and dbo.FN_XU_ES_DIA_HABIL(fecha, null) = 1
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo in (1215, 1815)
			and xas.fecha = a.fecha
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Agrego los registros de Retenciones de GANANCIAS por cada acreditacion de cierre de mensual*/
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	id_carpeta_sub_producto,
	id_xu_csp,
	fecha,
	'RET. DE IMP. A LAS GCIAS.' as concepto,
	1212 as tipo,
	cotizacion,
	tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	/* por cada cierre de mes... */
	a.tipo = 1211
	/* ... correspondiente a la cuenta en proceso... */
	and a.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1212
			and xas.fecha = a.fecha
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Agrego los registros de Retenciones ITF por cada acreditacion de cierre de mensual */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	id_carpeta_sub_producto,
	id_xu_csp,
	fecha,
	'RET. DE ITF.' as concepto,
	1213 as tipo,
	cotizacion,
	tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	/* por cada cierre mensual... */
	a.tipo = 1211
	/* ... correspondiente a la cuenta en proceso... */
	and a.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1213
			and xas.fecha = a.fecha
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Agrego los registros de devengamiento de días inhabiles por cada acreditacion de cierre mensual (DEPRECATED) */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	id_carpeta_sub_producto,
	id_xu_csp,
	fecha,
	'DEV. INT.' as concepto,
	1801 as tipo,
	cotizacion,
	dbo.FN_XU_OBTENER_TASA(
		a.id_carpeta_sub_producto,
		dbo.fn_xu_ultimo_dia_habil(fecha)
	) as tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	/* por cada cierre de cuenta... */
	a.tipo = 1211
	and 1 = 0 --DEPRECATED
	/* al menos ayer fue día inhabil */
	and dbo.FN_XU_ES_DIA_HABIL(fecha -86400, null) = 0
	/* ... correspondiente a la cuenta en proceso... */
	and a.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo in (1201, 1801)
			and xas.fecha = a.fecha
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/**************************** MOVIMIENTOS CIERRE DE CUENTA ***************************************************/
/* Agrego un Registro de Acreditación por cada evento de cierre */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	id_carpeta_sub_producto,
	id_xu_csp,
	fecha,
	'ACREDITACIÓN DE INTERESES' as concepto,
	1610 as tipo,
	cotizacion,
	tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	/* por cada cierre de cuenta... */
	a.tipo = 1730
	/* ... correspondiente a la cuenta en proceso... */
	and a.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1610
			and xas.fecha = a.fecha
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Agrego un Registro de Extracción Final por cada evento de cierre */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	id_carpeta_sub_producto,
	id_xu_csp,
	fecha,
	'EXTRACCIÓN POR CIERRE DE CTA' as concepto,
	1702 as tipo,
	cotizacion,
	tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	/* por cada cierre de cuenta... */
	a.tipo = 1730
	/* ... correspondiente a la cuenta en proceso... */
	and a.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1702
			and xas.fecha = a.fecha
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Agrego un registro de Devengamiento de Interés por cada registro de Acreditación de cierre de cuenta */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	id_carpeta_sub_producto,
	id_xu_csp,
	fecha,
	'DEV. INT.' as concepto,
	1601 as tipo,
	cotizacion,
	tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	/* por cada cierre de cuenta... */
	a.tipo = 1610
	/* ... correspondiente a la cuenta en proceso... */
	and a.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1601
			and xas.fecha = a.fecha
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Agrego los registros de Retenciones de GANANCIAS por cada acreditacion de cierre de cuenta*/
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	id_carpeta_sub_producto,
	id_xu_csp,
	fecha,
	'RET. DE IMP. A LAS GCIAS.' as concepto,
	1611 as tipo,
	cotizacion,
	tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	/* por cada cierre de cuenta... */
	a.tipo = 1610
	/* ... correspondiente a la cuenta en proceso... */
	and a.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1611
			and xas.fecha = a.fecha
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Agrego los registros de Retenciones de IIBB por cada acreditacion de cierre de cuenta*/
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	id_carpeta_sub_producto,
	id_xu_csp,
	fecha,
	'RET. DE IIBB.' as concepto,
	1613 as tipo,
	cotizacion,
	tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	/* por cada cierre de cuenta... */
	a.tipo = 1610
	/* ... correspondiente a la cuenta en proceso... */
	and a.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1613
			and xas.fecha = a.fecha
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Agrego los registros de Retenciones ITF por cada acreditacion de cierre de cuenta*/
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	id_carpeta_sub_producto,
	id_xu_csp,
	fecha,
	'RET. DE ITF.' as concepto,
	1612 as tipo,
	cotizacion,
	tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	/* por cada cierre de cuenta... */
	a.tipo = 1610
	/* ... correspondiente a la cuenta en proceso... */
	and a.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1612
			and xas.fecha = a.fecha
			and xas.id_carpeta_sub_producto = @IdCSP
	);

/* Actualizo la cotizacion */
merge into xu_actualizacion_saldos aa using (
	select
		a.id_xu_actualizacion_saldo,
case
			when mh.cotizacion is not null then mh.cotizacion
			else m.cotizacion
		end as cotizacion
	from
		xu_actualizacion_saldos a
		inner join carpeta_sub_productos csp on a.id_carpeta_sub_producto = csp.id_carpeta_sub_producto
		inner join monedas m on m.id_moneda = csp.id_moneda
		left join monedas_historico mh on mh.id_moneda = m.id_moneda
		and a.fecha < mh.fecha_modificacion
		and not exists (
			select
				*
			from
				monedas_historico mhx
			where
				mhx.fecha_modificacion < mh.fecha_modificacion
				and a.fecha < mhx.fecha_modificacion
				and mhx.id_moneda = mh.id_moneda
		)
	where
		a.cotizacion is null
		and a.id_carpeta_sub_producto = @IdCSP
) ab on (
	aa.id_xu_actualizacion_saldo = ab.id_xu_actualizacion_saldo
)
when matched then
update
set
	cotizacion = ab.cotizacion;

-- Agrego los registros de actualización por migración XU_ACTUALIZACION_POR_MIGRA TIPO 1102.
insert into
	xu_actualizacion_saldos (
		id_xu_csp,
		id_carpeta_sub_producto,
		fecha,
		tipo,
		concepto,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_itf,
		s_embargo,
		s_ret_iibb,
		s_iva,
		saldo_actual,
		monto_orig
	)
select
	x.id_xu_csp,
	apm.id_carpeta_sub_producto,
	apm.fecha,
	apm.tipo,
	apm.concepto,
	apm.monto,
	apm.s_capital,
	apm.s_interes,
	apm.s_ret_iigg,
	apm.s_itf,
	apm.s_embargo,
	apm.s_ret_iibb,
	apm.s_iva,
	apm.saldo_actual,
	apm.monto_orig
from
	xu_actualizacion_por_migra apm
	inner join xu_csp x on x.id_carpeta_sub_producto = apm.id_carpeta_sub_producto
where
	/* por cada registro de migración... */
	apm.tipo = 1102
	/* ... correspondiente a la cuenta en proceso... */
	and apm.id_carpeta_sub_producto = @IdCSP
	/* ... si ya no hay otro registro de este tipo para esta fecha */
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos a
		where
			tipo = 1102
			and a.id_carpeta_sub_producto = apm.id_carpeta_sub_producto
			and a.fecha = apm.fecha
	);

/* Genero los registros de RET. DE ITF por transferencias con terceros (1501), agrupados por dia */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	@IdCSP as id_carpeta_sub_producto,
	min(a.id_xu_csp) as id_xu_csp,
	max(a.fecha) as fecha,
	'RET. DE ITF POR TRANSF. CTA. TERCEROS' as concepto,
	1501 as tipo,
	min(a.cotizacion) as cotizacion,
	min(a.tasa_diaria) as tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	a.tipo in (1403, 1404)
	and a.id_carpeta_sub_producto = @IdCSP
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1501
			and dbo.FN_DATE_TO_CHAR(xas.fecha, 'YYYYMMDD') = dbo.FN_DATE_TO_CHAR(a.fecha, 'YYYYMMDD')
			and xas.id_carpeta_sub_producto = @IdCSP
	)
group by
	dbo.FN_DATE_TO_CHAR(a.fecha, 'YYYYMMDD');

/* Genero los registros de RET. DE IIBB por transferencias con terceros (1502), agrupados por dia */
insert into
	xu_actualizacion_saldos (
		id_carpeta_sub_producto,
		id_xu_csp,
		fecha,
		concepto,
		tipo,
		cotizacion,
		tasa_diaria,
		monto,
		s_capital,
		s_interes,
		s_ret_iigg,
		s_ret_iibb,
		s_itf,
		s_embargo,
		reg_orden,
		procesado,
		id_xc_documento,
		cod_medio,
		cod_origen,
		cod_sucursal,
		cod_canal,
		aux
	)
select
	@IdCSP as id_carpeta_sub_producto,
	min(a.id_xu_csp) as id_xu_csp,
	max(a.fecha) as fecha,
	'RET. DE IIBB POR TRANSF. CTA. TERCEROS' as concepto,
	1502 as tipo,
	min(a.cotizacion) as cotizacion,
	min(a.tasa_diaria) as tasa_diaria,
	0 as monto,
	0 as s_capital,
	0 as s_interes,
	0 as s_ret_iigg,
	0 as s_ret_iibb,
	0 as s_itf,
	0 as s_embargo,
	null as reg_orden,
	null as procesado,
	null as id_xc_documento,
	null as cod_medio,
	null as cod_origen,
	null as cod_sucursal,
	null as cod_canal,
	null as aux
from
	xu_actualizacion_saldos a
where
	a.tipo = 1403
	and a.id_carpeta_sub_producto = @IdCSP
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos xas
		where
			xas.tipo = 1502
			and dbo.FN_DATE_TO_CHAR(xas.fecha, 'YYYYMMDD') = dbo.FN_DATE_TO_CHAR(a.fecha, 'YYYYMMDD')
			and xas.id_carpeta_sub_producto = @IdCSP
	)
group by
	dbo.FN_DATE_TO_CHAR(a.fecha, 'YYYYMMDD');

/* Actualizo la tasa */
update
	xu_actualizacion_saldos
set
	tasa_diaria = dbo.fn_xu_obtener_tasa(id_carpeta_sub_producto, fecha)
where
	tasa_diaria is null
	and id_carpeta_sub_producto = @IdCSP;

SET
	@RegOrdenEsperado = 1;

/* Abro el cursor */
OPEN CURSOR_CAMBIOS
/* Tomo el primer registro */
FETCH NEXT
FROM
	CURSOR_CAMBIOS INTO @ID_XU_ACTUALIZACION_SALDO,
	@REG_ORDEN
	/*Checkeo si hubo cambios: Registros eliminados, Registros agregados en el medio, etc.*/
	WHILE @ @FETCH_STATUS = 0 BEGIN
	/* Si el REG_ORDEN no es el que esperaba (hay un salto), marco el registro como cambiado para ser reprocesado */
	IF (@REG_ORDEN <> @RegOrdenEsperado) BEGIN
update
	xu_actualizacion_saldos
set
	reg_orden = null,
	procesado = null
where
	id_xu_actualizacion_saldo = @id_xu_actualizacion_saldo;

/* Todos los subsiguientes van a ser actualizados. Espero un REG_ORDEN imposible para lograr Ã©sto*/
SET
	@RegOrdenEsperado = -1;

END
ELSE BEGIN
/*si es el que  esperaba, aumento en 1 la variable.*/
SET
	@RegOrdenEsperado = @RegOrdenEsperado + 1;

END FETCH NEXT
FROM
	CURSOR_CAMBIOS INTO @ID_XU_ACTUALIZACION_SALDO,
	@REG_ORDEN
END;

/* Cierro y Desaloco el Cursor */
CLOSE CURSOR_CAMBIOS DEALLOCATE CURSOR_CAMBIOS COMMIT
/* Ejecuto los inversos de contabilidad para todos los registros que tenían documento pero deben ser reprocesados */
--exec dbo.SP_XU_INVERSOS
/* Computo los saldos para completar la actualizacion de la deuda */
EXEC SP_XU_COMPUTAR_1CCR_MENS @IdCSP,
@Debug
END;

SP_XU_ACTUALIZAR_1SALDO CREATE PROCEDURE SP_XU_ACTUALIZAR_1SALDO (@IdCSP int, @Debug int) AS BEGIN BEGIN TRANSACTION
/* Borrar la actualización de saldos anterior */
delete from
	xu_actualizacion_saldos
where
	id_carpeta_sub_producto = @IdCSP
	/* Colocar el movimiento de apertura de cuenta */
insert into
	xu_actualizacion_saldos (
		tipo,
		concepto,
		saldo_actual,
		monto,
		monto_orig,
		fecha,
		id_xu_movimiento,
		reg_orden,
		procesado,
		id_carpeta_sub_producto
	)
select
	x.tipo,
	x.concepto,
	x.saldo_actual,
	x.monto,
	x.monto_orig,
	csp.fecha_orig,
	x.id_xu_movimiento,
	x.reg_orden,
	x.procesado,
	csp.id_carpeta_sub_producto
from
	(
		select
			101 as tipo,
			'Apertura de Cuenta' as concepto,
			0 as saldo_actual,
			0 as monto,
			0 as monto_orig,
			null as id_xu_movimiento,
			null as reg_orden,
			null as procesado
		from
			dual
	) x,
	carpeta_sub_productos csp
where
	csp.id_carpeta_sub_producto = @IdCSP
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos
		where
			tipo = x.tipo
			and id_carpeta_sub_producto = @IdCSP
	)
	/* Agregar lo créditos */
insert into
	xu_actualizacion_saldos (
		tipo,
		concepto,
		saldo_actual,
		monto,
		monto_orig,
		fecha,
		id_xu_movimiento,
		reg_orden,
		procesado,
		id_carpeta_sub_producto,
		cod_origen
	)
select
	x.tipo,
	x.concepto,
	x.saldo_actual,
	x.monto,
	x.monto_orig,
	x.fecha,
	x.id_xu_movimiento,
	x.reg_orden,
	x.procesado,
	csp.id_carpeta_sub_producto,
	x.cod_origen
from
	(
		select
			301 as tipo,
			'Credito:' as concepto,
			0 as saldo_actual,
			xumov.monto as monto,
			xumov.monto as monto_orig,
			xumov.fecha as fecha,
			xumov.id_xu_movimiento as id_xu_movimiento,
			xumov.cod_origen as cod_origen,
			null as reg_orden,
			null as procesado
		from
			xu_movimientos xumov,
			xu_tipos_movimientos xtm,
			xu_csp xucsp
		where
			xtm.param1 like '%|CREDITO|%'
			and xumov.id_xu_tipo_movimiento = xtm.id_xu_tipo_movimiento
			and xucsp.id_carpeta_sub_producto = @idcsp
			and xumov.id_xu_csp = xucsp.id_xu_csp
	) x,
	carpeta_sub_productos csp
where
	csp.id_carpeta_sub_producto = @IdCSP
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos
		where
			tipo = x.tipo
			and id_carpeta_sub_producto = @IdCSP
			and id_xu_movimiento = x.id_xu_movimiento
	)
	/* Agregar lo débitos */
insert into
	xu_actualizacion_saldos (
		tipo,
		concepto,
		saldo_actual,
		monto,
		monto_orig,
		fecha,
		id_xu_movimiento,
		reg_orden,
		procesado,
		id_carpeta_sub_producto,
		cod_origen
	)
select
	x.tipo,
	x.concepto,
	x.saldo_actual,
	x.monto,
	x.monto_orig,
	x.fecha,
	x.id_xu_movimiento,
	x.reg_orden,
	x.procesado,
	csp.id_carpeta_sub_producto,
	x.cod_origen
from
	(
		select
			401 as tipo,
			'Debito:' as concepto,
			0 as saldo_actual,
			xumov.monto as monto,
			xumov.monto as monto_orig,
			xumov.fecha as fecha,
			xumov.id_xu_movimiento as id_xu_movimiento,
			xumov.cod_origen as cod_origen,
			null as reg_orden,
			null as procesado
		from
			xu_movimientos xumov,
			xu_tipos_movimientos xtm,
			xu_csp xucsp
		where
			xtm.param1 like '%|DEBITO|%'
			and xumov.id_xu_tipo_movimiento = xtm.id_xu_tipo_movimiento
			and xucsp.id_carpeta_sub_producto = @IdCSP
			and xumov.id_xu_csp = xucsp.id_xu_csp
	) x,
	carpeta_sub_productos csp
where
	csp.id_carpeta_sub_producto = @IdCSP
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos
		where
			tipo = x.tipo
			and id_carpeta_sub_producto = @idcsp
			and id_xu_movimiento = x.id_xu_movimiento
	)
	/* Colocar el movimiento con el saldo actual */
insert into
	xu_actualizacion_saldos (
		tipo,
		concepto,
		saldo_actual,
		monto,
		monto_orig,
		fecha,
		id_xu_movimiento,
		cod_origen,
		reg_orden,
		procesado,
		id_carpeta_sub_producto
	)
select
	601 as tipo,
	'Saldo Actual a ' + dbo.FN_DATE_TO_CHAR(csp.fecha_actual, 'DD/MM/YYYY') as concepto,
	0 as saldo_actual,
	0 as monto,
	0 as monto_orig,
	csp.fecha_orig as fecha,
	null as id_xu_movimiento,
	null as cod_origen,
	null as reg_orden,
	null as procesado,
	csp.id_carpeta_sub_producto
from
	carpeta_sub_productos csp
where
	csp.id_carpeta_sub_producto = @IdCSP
	and not exists (
		select
			*
		from
			xu_actualizacion_saldos
		where
			tipo = 601
			and id_carpeta_sub_producto = @IdCSP
	) COMMIT EXEC SP_XU_COMPUTAR_SALDO @IdCSP,
	@Debug
END SP_XU_ACTUALIZAR_SALDOS CREATE PROCEDURE [dbo].[SP_XU_ACTUALIZAR_SALDOS] (
	@IdCSPEntrada int = null,
	@BorraryRegenerar int = null,
	@Debug int = null
) AS BEGIN DECLARE @Aux nvarchar(4000),
@IdCsp varchar(4000),
@Sp varchar(4000)
/* Selecciono todos los CSPs que tienen XU_CSP */
DECLARE CURSOR_SALDOS cursor for
select
	csp.id_carpeta_sub_producto,
	sp_actualizacion
from
	estados e,
	carpeta_sub_productos csp,
	xu_csp xucsp,
	xu_tipos_cuenta xutc,
	xu_sistemas xus
where
	e.id_estado = csp.id_estado
	and csp.id_carpeta_sub_producto = xucsp.id_carpeta_sub_producto
	and csp.id_sub_producto = xutc.id_sub_producto
	and xutc.id_xu_sistema = xus.id_xu_sistema
	and (
		@IdCSPEntrada is null
		OR (
			@IdCSPEntrada > 0
			and csp.id_carpeta_sub_producto = @IdCSPEntrada
		)
		OR (
			@IdCSPEntrada <= 0
			and csp.id_carpeta_sub_producto % 10 = - @IdCSPEntrada
		)
	)
	/* Sólo ejecuto si es un día hábil */
	IF (dbo.FN_XU_ES_DIA_HABIL(NULL, 'BANCARIO') = 1) BEGIN
	/* Abro el cursor */
	OPEN CURSOR_SALDOS
	/* Tomo el primer registro */
	FETCH NEXT
FROM
	CURSOR_SALDOS INTO @IdCsp,
	@Sp
	/* Mientras sea un registro válido... */
	WHILE @ @FETCH_STATUS = 0 BEGIN
	/* Tomo el primer registro */
SET
	@Aux = '>>> Procesando CSP ID_CSP=' + dbo.TOCHAR(@IdCsp) EXEC dbo.SP_LOG_STR @Aux
	/* Si es necesario borro todo antes de regenerar el cálculo */
	IF coalesce(@BorraryRegenerar, 0) = 1 BEGIN
delete from
	xu_actualizacion_saldos
where
	id_carpeta_sub_producto = @IdCsp
END
/* Ejecuto el SP indicado para el préstamo del registro */
SET
	@Aux = @Sp + ' ' + dbo.TOCHAR(@IdCsp) + ',' + dbo.TOCHAR(coalesce(@Debug, 0)) EXEC dbo.SP_LOG_STR @Aux EXEC sp_executesql @Aux FETCH NEXT
FROM
	CURSOR_SALDOS INTO @IdCsp,
	@Sp
END
/* Cierro y Desaloco el Cursor */
CLOSE CURSOR_SALDOS;

DEALLOCATE CURSOR_SALDOS
END
END SP_XU_CCR_ALTA CREATE PROCEDURE [dbo].[SP_XU_CCR_ALTA] (
	@IdCarpeta int,
	@IdTipoCuenta int,
	@TasaInteres int
) AS BEGIN DECLARE @Sucursal varchar(1024),
@CSP int,
@NroCuenta varchar(20)
select
	@Sucursal = valor
from
	configuracion
where
	parametro like 'SUCURSAL'
insert into
	carpeta_sub_productos (
		id_carpeta,
		id_sub_producto,
		nombre_producto,
		fecha_orig,
		fecha_actual,
		id_estado,
		nivel,
		id_moneda
	)
select
	c.id_carpeta as id_carpeta,
	sp.id_sub_producto as id_sub_producto,
	sp.nombre as nombre_producto,
	dbo.AHORA() as fecha_orig,
	dbo.AHORA() as fecha_actual,
	e.id_estado as id_estado,
	100 as nivel,
	m.id_moneda as id_moneda
from
	carpetas c,
	xu_tipos_cuenta tc,
	sub_productos sp,
	monedas m,
	estados e
where
	c.id_carpeta = @IdCarpeta
	and tc.id_xu_tipo_cuenta = @IdTipoCuenta
	and tc.id_sub_producto = sp.id_sub_producto
	and tc.id_moneda = m.id_moneda
	and e.codigo = 'ABIERTA'
select
	@CSP = max(id_carpeta_sub_producto)
from
	carpeta_sub_productos
where
	id_carpeta = @IdCarpeta --inserta en xu_csp
insert into
	xu_csp (
		id_carpeta_sub_producto,
		numero_cuenta,
		fecha_apertura,
		fecha_cierre,
		id_xu_tipo_cuenta,
		id_estado,
		saldo_min_interes,
		tasa_interes,
		saldo_min_gasto_mensual,
		gasto_mensual
	)
select
	id_csp as id_carpeta_sub_producto,
	0 as numero_cuenta,
	dbo.AHORA() as fecha_orig,
	null as fecha_cierre,
	tc.id_xu_tipo_cuenta as id_xu_tipo_cuenta,
	e.id_estado as id_estado,
	tc.saldo_min_interes as saldo_min_interes,
	@TasaInteres as tasa_interes,
	tc.saldo_min_gasto_mensual as saldo_min_gasto_mensual,
	tc.gasto_mensual as gasto_mensual
from
	(
		select
			max(id_carpeta_sub_producto) as id_csp
		from
			carpeta_sub_productos
		where
			id_carpeta = @IdCarpeta
	) csp,
	xu_tipos_cuenta tc,
	estados e
where
	tc.id_xu_tipo_cuenta = @IdTipoCuenta
	and e.codigo = 'ABIERTA'
select
	@NroCuenta = dbo.FN_XU_GENERAR_NROCTA (@Sucursal, id_xu_csp)
from
	xu_csp
where
	id_carpeta_sub_producto = @CSP --Para el numero de cuenta, tengo que actualizarle el numero de cuenta con el ID_XU_CSP
update
	xu_csp
set
	numero_cuenta = @NroCuenta
where
	id_carpeta_sub_producto = @CSP
update
	carpeta_sub_productos
set
	concepto = @NroCuenta
where
	id_carpeta_sub_producto = @CSP
END SP_XU_COMPUTAR_1CCR_MENS CREATE PROCEDURE SP_XU_COMPUTAR_1CCR_MENS (
	@IdCSPEntrada int,
	@Debug int = NULL
) AS BEGIN DECLARE @MaxRegOrden int,
@Hoy int,
@FechaAnt int,
@FechaAntReg int,
@EstaCuenta int,
@RegOrden int,
@Concepto varchar(100),
@Entorno varchar(100),
@Aux varchar(2048),
/* Variables usadas acumuladas en el calculo */
@Capital float,
@Interes float,
@RetIIGG float,
@RetIIBB float,
@ITF float,
@Embargo float,
/* Variables cursor */
@IdXuActualizacion int,
@IdCSP int,
@Fecha int,
@Tipo int,
@TasaDiaria float,
@Monto float,
@SCapital float,
@SInteres float,
@SRetIigg float,
@SRetIibb float,
@SItf float,
@SEmbargo float,
@Concepto_cur varchar(100),
@RegOrden_cur varchar(10),
/* Variable para alicuota SIRCREB leida de csp.D2 */
@AlicuotaSIRCREB float,
/* Acumulador de montos de transferencias con terceros del dia, para calcular retenciones en 1501/1502 */
@MontoTercerosDia float,
@MontoTercerosDiaEm float
/* Busco los registros que deben ser computados */
DECLARE REGISTROS_CCR CURSOR FOR
select
	*
from
	(
		select
			id_xu_actualizacion_saldo,
			id_carpeta_sub_producto,
			fecha,
			tipo,
			coalesce(tasa_diaria, 0) as tasa_diaria,
			coalesce(monto, 0) as monto,
			coalesce(s_capital, 0) as s_capital,
			coalesce(s_interes, 0) as s_interes,
			coalesce(s_ret_iigg, 0) as s_ret_iigg,
			coalesce(s_ret_iibb, 0) as s_ret_iibb,
			coalesce(s_itf, 0) as s_itf,
			coalesce(s_embargo, 0) as s_embargo,
			concepto,
			coalesce(reg_orden, 0) as reg_orden
		from
			xu_actualizacion_saldos
		where
			procesado is null
			and id_carpeta_sub_producto = @IdCSPEntrada
		union
		all
		select
			-1 as id_xu_actualizacion_saldo,
			id_carpeta_sub_producto,
			fecha,
			-1 as tipo,
			coalesce(tasa_diaria, 0),
			coalesce(monto, 0),
			coalesce(s_capital, 0) as s_capital,
			coalesce(s_interes, 0) as s_interes,
			coalesce(s_ret_iigg, 0) as s_ret_iigg,
			coalesce(s_ret_iibb, 0) as s_ret_iibb,
			coalesce(s_itf, 0) as s_itf,
			coalesce(s_embargo, 0) as s_embargo,
			concepto,
			coalesce(reg_orden, 0) -1
		from
			xu_actualizacion_saldos ult_act
		where
			ult_act.id_carpeta_sub_producto = @IdCSPEntrada
			and ult_act.reg_orden is not null
			and ult_act.reg_orden = @MaxRegOrden
	) x
order by
	dbo.FN_DATE_TO_CHAR(fecha, 'YYYYMMDD'),
	tipo,
	fecha;

BEGIN TRANSACTION
/*Levanto el valor del entorno*/
select
	@Entorno = c.valor
from
	configuracion c
where
	parametro = 'ENTORNO_ACTUALIZACION_CVISTA';

select
	@MaxRegOrden = max(ult.reg_orden)
from
	xu_actualizacion_saldos ult
where
	ult.id_carpeta_sub_producto = @IdCSPEntrada
group by
	ult.id_carpeta_sub_producto;

/* Determino el dia al cual se esta actualizando */
SET
	@Hoy = dbo.HOY();

/* Inicializo los registros con 0 */
SET
	@Capital = 0;

SET
	@Interes = 0;

SET
	@RetIIGG = 0;

SET
	@RetIIBB = 0;

SET
	@ITF = 0;

SET
	@Embargo = 0;

SET
	@RegOrden = 0;

SET
	@EstaCuenta = 0;

SET
	@MontoTercerosDia = 0;

SET
	@MontoTercerosDiaEm = 0;

/* Levanto la alicuota SIRCREB desde csp.D2 (formato SIRCREB=<alicuota>-<fecha_modificacion>) */
BEGIN TRY
select
	@AlicuotaSIRCREB = dbo.TONUMBER(
		SUBSTRING(
			dbo.FN_GET_PARAM(c.D2, 'SIRCREB'),
			1,
			CHARINDEX('-', dbo.FN_GET_PARAM(c.D2, 'SIRCREB')) - 1
		)
	)
from
	carpeta_sub_productos csp
	inner join carpetas c on c.id_carpeta = csp.id_carpeta
where
	csp.id_carpeta_sub_producto = @IdCSPEntrada;

END TRY BEGIN CATCH
SET
	@AlicuotaSIRCREB = 0;

END CATCH;

/* Abro el cursor */
OPEN REGISTROS_CCR
/* Si hay registros para procesar... */
FETCH NEXT
FROM
	REGISTROS_CCR INTO @IdXuActualizacion,
	@IdCSP,
	@Fecha,
	@Tipo,
	@TasaDiaria,
	@Monto,
	@SCapital,
	@SInteres,
	@SRetIigg,
	@SRetIibb,
	@SItf,
	@SEmbargo,
	@Concepto_cur,
	@RegOrden_cur;

/* Si hay registros para procesar... */
WHILE @ @FETCH_STATUS = 0 BEGIN IF (@RegOrden = 0) BEGIN
SET
	@FechaAnt = @Fecha;

SET
	@FechaAntReg = @FechaAntReg;

END IF (
	dbo.FN_DATE_TO_CHAR(@FechaAntReg, 'DD/MM/YYYY') <> dbo.FN_DATE_TO_CHAR(@Fecha, 'DD/MM/YYYY')
) BEGIN
SET
	@FechaAnt = @FechaAntReg;

END
SET
	@Concepto = @Concepto_cur;

IF (
	@EstaCuenta <> @IdCSP
	AND @EstaCuenta <> 0
) BEGIN
/* Guardo los valores en Carpeta_Sub_Producto, antes de comenzar con la nueva */
update
	carpeta_sub_productos
set
	fecha_actual = @Hoy,
	capital_actual = @Capital + @Interes - @RetIIGG - @RetIIBB - @ITF - @Embargo
where
	id_carpeta_sub_producto = @EstaCuenta;

/* Me guardo el ID_XP_CUOTA del nuevo registro sobre el que se está haciendo el cálculo */
SET
	@EstaCuenta = @IdCSP;

/* Aún no hubo un registro anterior de este producto, luego seteo la fecha anterior igual a la de este registro */
SET
	@FechaAnt = @Fecha;

/* Tomo el Número de Registro */
SET
	@RegOrden = @RegOrden_cur;

/* Inicializo los registros con 0 */
SET
	@Capital = 0;

SET
	@Interes = 0;

SET
	@RetIIGG = 0;

SET
	@RetIIBB = 0;

SET
	@ITF = 0;

SET
	@Embargo = 0;

SET
	@MontoTercerosDia = 0;

SET
	@MontoTercerosDiaEm = 0;

END
/* Si recibi DEBUG = 1, muestro detalles por consola. */
IF (coalesce(@Debug, 0) = 1) BEGIN
/* Imprimo el ecanbezado d e este registro */
EXEC SP_LOG_STR '---------------------------------------------';

SET
	@Aux = 'ID_CSP          : ' + COALESCE(dbo.TOCHAR(@EstaCuenta), 'NULL') EXEC SP_LOG_STR @Aux
SET
	@Aux = 'Tipo            : ' + COALESCE(dbo.TOCHAR(@Tipo), 'NULL') EXEC SP_LOG_STR @Aux
END IF @Tipo = -1
/* Es un registro de sincronización  */
BEGIN
/* Inicializo todos los saldos en 0 */
SET
	@Capital = @SCapital
SET
	@Interes = @SInteres
SET
	@RetIIGG = @SRetIigg
SET
	@RetIIBB = @SRetIibb
SET
	@ITF = @SItf
SET
	@Embargo = @SEmbargo
SET
	@RegOrden = @RegOrden_cur
END IF @Tipo = 1101
/* Es un registro de APERTURA  */
BEGIN
/* Inicializo todos los saldos en 0 */
SET
	@Capital = 0;

SET
	@Interes = 0;

SET
	@RetIIGG = 0;

SET
	@RetIIBB = 0;

SET
	@ITF = 0;

SET
	@Embargo = 0;

SET
	@Monto = 0;

END IF @Tipo = 1102
/* Es un registro de MIGRACIÓN  */
BEGIN
SET
	@Capital = @SCapital
SET
	@Interes = @SInteres;

SET
	@RetIIGG = @SRetIigg;

SET
	@RetIIBB = @SRetIibb;

SET
	@ITF = @SItf;

SET
	@Embargo = @SEmbargo;

SET
	@Monto = @Monto;

END IF @Tipo = 1401
/* Es un registro de TRANSFERENCIA ACREDITADA - Exento ITF/IIBB/IIGG */
BEGIN
SET
	@Capital = @Capital + @Monto;

END IF @Tipo = 1402
/* Es un registro de TRANSFERENCIA DEBITADA - Exento ITF/IIBB/IIGG */
BEGIN
SET
	@Capital = @Capital + @Monto;

END IF @Tipo = 1403
/* Es un registro de TRANSFERENCIA CUENTA TERCERO RECIBIDA - Gravado ITF e IIBB via 1501/1502 */
BEGIN
SET
	@Capital = @Capital + @Monto;

SET
	@MontoTercerosDia = @MontoTercerosDia + ABS(@Monto);

SET
	@MontoTercerosDiaEm = @MontoTercerosDiaEm + ABS(@Monto);

END IF @Tipo = 1404
/* Es un registro de TRANSFERENCIA CUENTA TERCERO EMITIDA - Gravado ITF via 1501*/
BEGIN
SET
	@Capital = @Capital + @Monto;

SET
	@MontoTercerosDiaEm = @MontoTercerosDiaEm + ABS(@Monto);

END IF @Tipo = 1501
/* Es un registro de RET. DE ITF POR TRANSF. CTA. TERCEROS - liquida el ITF del dia */
BEGIN
SET
	@Monto = -(@MontoTercerosDiaEm * 0.006);

SET
	@Capital = @Capital + @Monto;

SET
	@MontoTercerosDiaEm = 0;

END IF @Tipo = 1502
/* Es un registro de RET. DE IIBB POR TRANSF. CTA. TERCEROS - liquida el IIBB del dia */
BEGIN
SET
	@Monto = -(
		(
			@MontoTercerosDia * coalesce(@AlicuotaSIRCREB, 0)
		) / 100
	);

SET
	@Capital = @Capital + @Monto;

SET
	@MontoTercerosDia = 0;

END IF @Tipo = 1411
/* Es un registro de EMBARGO */
BEGIN
SET
	@Capital = @Capital + @Monto;

SET
	@Embargo = @Embargo - @Monto;

END IF @Tipo = 1412
/* Es un registro de DEVOLUCIÓN DE EMBARGO */
BEGIN
SET
	@Capital = @Capital + @Monto;

SET
	@Embargo = @Embargo - @Monto;

END IF @Tipo = 1421
/* Es un registro de AJUSTE SOBRE CAPITAL */
BEGIN
SET
	@Capital = @Capital + @Monto;

END IF @Tipo = 1422
/* Es un registro de AJUSTE SOBRE INTERESES DEVENGADOS */
BEGIN
SET
	@Interes = @Interes + @Monto;

END IF @Tipo = 1702
/* Es un registro de CIERRE DE CUENTA */
BEGIN
SET
	@Monto = - @Capital;

SET
	@Capital = 0;

END IF @Tipo = 1730
/* Es un registro de CIERRE DE CUENTA */
BEGIN
SET
	@Monto = 0;

END IF @Tipo = 1201
/* Es un registro de DEVENGAMIENO DE INTERESES de días inhábiles */
BEGIN
SET
	@Monto = CASE
		WHEN @Capital <= 0 THEN 0
		ELSE @Capital * 0.01 * @TasaDiaria / 365.0 * (floor((@Fecha - @FechaAnt) / 86400))
	END;

SET
	@Interes = @Interes + @Monto;

SET
	@Aux = (
		'@Fecha: ' + dbo.FN_DATE_TO_CHAR(@Fecha, 'DD/MM/YYYY')
	);

EXEC SP_LOG_STR @Aux
SET
	@Aux = (
		'@FechaAnt: ' + dbo.FN_DATE_TO_CHAR(@FechaAnt, 'DD/MM/YYYY')
	);

EXEC SP_LOG_STR @Aux
SET
	@Concepto = 'DEV. INT. TASA: ' + dbo.TOCHAR(@TasaDiaria) + '% DIAS: ' + dbo.TOCHAR(floor((@Fecha - @FechaAnt) / 86400));

END IF @Tipo = 1801
/* Es un registro de DEVENGAMIENO DE INTERESES de días inhábiles */
BEGIN
SET
	@Monto = CASE
		WHEN @Capital <= 0 THEN 0
		ELSE @Capital * 0.01 * @TasaDiaria / 365.0 * (floor((@Fecha - @FechaAnt) / 86400))
	END;

SET
	@Interes = @Interes + @Monto;

SET
	@Aux = (
		'@Fecha: ' + dbo.FN_DATE_TO_CHAR(@Fecha, 'DD/MM/YYYY')
	);

EXEC SP_LOG_STR @Aux
SET
	@Aux = (
		'@FechaAnt: ' + dbo.FN_DATE_TO_CHAR(@FechaAnt, 'DD/MM/YYYY')
	);

EXEC SP_LOG_STR @Aux
SET
	@Concepto = 'DEV. INT. TASA: ' + dbo.TOCHAR(@TasaDiaria) + '% DIAS: ' + dbo.TOCHAR(floor((@Fecha - @FechaAnt) / 86400));

END IF @Tipo = 1601
/* Es un registro de DEVENGAMIENO DE INTERESES de días hábiles */
BEGIN
SET
	@Monto = CASE
		WHEN @Capital <= 0 THEN 0
		ELSE @Capital * 0.01 * @TasaDiaria / 365.0
	END;

SET
	@Interes = @Interes + @Monto;

SET
	@Concepto = 'DEV. INT. TASA: ' + dbo.TOCHAR(@TasaDiaria) + '% DIAS: 1';

END IF @Tipo = 1215
/* Es un registro de DEVENGAMIENO DE INTERESES de días hábiles */
BEGIN
SET
	@Monto = CASE
		WHEN @Capital <= 0 THEN 0
		ELSE @Capital * 0.01 * @TasaDiaria / 365.0
	END;

SET
	@Interes = @Interes + @Monto;

SET
	@Concepto = 'DEV. INT. TASA: ' + cast(@TasaDiaria as varchar) + '% DIAS: 1';

END IF @Tipo = 1815
/* Es un registro de DEVENGAMIENO DE INTERESES de días hábiles */
BEGIN
SET
	@Monto = CASE
		WHEN @Capital <= 0 THEN 0
		ELSE @Capital * 0.01 * @TasaDiaria / 365.0
	END;

SET
	@Interes = @Interes + @Monto;

SET
	@Concepto = 'DEV. INT. TASA: ' + dbo.TOCHAR(@TasaDiaria) + '% DIAS: 1';

END IF @Tipo = 1610
/* Es un registro de ACREDITACION DE INTERESES (cierre cuenta) */
BEGIN
/* Determino La retención que debo hacer */
--Resp. Inscriptos... 3%
--No Inscriptos......10% 
--Con certificado.... 0%
SET
	@Monto = @Interes;

SET
	@RetIIGG = @RetIIGG + dbo.FN_XU_RETENCION(@EstaCuenta, @FechaAnt, @Fecha, @Interes, 'IIGG');

-- tkt 135133 pasa a ser siempre exento
--SET @RetIIBB   = @RetIIBB + dbo.FN_XU_RETENCION(@EstaCuenta, @FechaAnt, @Fecha, @Interes, 'IIBB');
SET
	@ITF = @ITF + @Interes * 0.006;

SET
	@Capital = @Capital + @Interes;

SET
	@Interes = 0;

END IF @Tipo = 1211
/* Es un registro de ACREDITACION DE INTERESES */
BEGIN
/* Determino La retención que debo hacer */
--Resp. Inscriptos... 3%
--No Inscriptos......10% 
--Con certificado.... 0%
SET
	@Monto = @Interes;

SET
	@RetIIGG = @RetIIGG + dbo.FN_XU_RETENCION(@EstaCuenta, @FechaAnt, @Fecha, @Interes, 'IIGG');

-- tkt 135133 pasa a ser siempre exento
-- SET @RetIIBB  = @RetIIBB + dbo.FN_XU_RETENCION(@EstaCuenta, @FechaAnt, @Fecha, @Interes, 'IIBB');
SET
	@ITF = @ITF + @Interes * 0.006;

SET
	@Capital = @Capital + @Interes;

SET
	@Interes = 0;

END IF @Tipo = 1611
/* Es un registro de RET. DE IMP.A LAS GCIAS.POR INTERES ACREDITADOS (cierre cuenta) */
BEGIN
SET
	@Monto = - @RetIIGG;

SET
	@Capital = @Capital - @RetIIGG;

SET
	@RetIIGG = 0;

END IF @Tipo = 1212
/* Es un registro de RET. DE IMP.A LAS GCIAS.POR INTERES ACREDITADOS (cierre cuenta) */
BEGIN
SET
	@Monto = - @RetIIGG;

SET
	@Capital = @Capital - @RetIIGG;

SET
	@RetIIGG = 0;

END IF @Tipo = 1612
/* Es un registro de RET. DE ITF POR INTERES ACREDITADOS (cierre cuenta) */
BEGIN
SET
	@Monto = - @ITF;

SET
	@Capital = @Capital - @ITF;

SET
	@ITF = 0;

END IF @Tipo = 1213
/* Es un registro de RET. DE ITF POR INTERES ACREDITADOS (cierre cuenta) */
BEGIN
SET
	@Monto = - @ITF;

SET
	@Capital = @Capital - @ITF;

SET
	@ITF = 0;

END IF @Tipo = 1613
/* Es un registro de RET. DE IIBB POR INTERES ACREDITADOS (cierre cuenta) */
BEGIN
SET
	@Monto = - @RetIIBB;

SET
	@Capital = @Capital - @RetIIBB;

SET
	@RetIIBB = 0;

END IF @Tipo = 1214
/* Es un registro de RET. DE IIBB POR INTERES ACREDITADOS (cierre cuenta) */
BEGIN
SET
	@Monto = - @RetIIBB;

SET
	@Capital = @Capital - @RetIIBB;

SET
	@RetIIBB = 0;

END
/* Calculo el Nro de Registro dentro de este producto */
SET
	@RegOrden = @RegOrden + 1;

/* Si recibi DEBUG = 1, muestro detalles por consola.*/
IF (COALESCE(@Debug, 0) = 1) BEGIN
/* Imprimo los importes y saldos de la cuota en este movimiento, con fines de DEBUGGING */
SET
	@Aux =(
		'Monto           : ' + COALESCE(dbo.TOCHAR(@Monto), 'NULL')
	);

EXEC SP_LOG_STR @Aux EXEC SP_LOG_STR ' '
SET
	@Aux =(
		'Sdo Capital     : ' + COALESCE(dbo.TOCHAR(@Capital), 'NULL')
	);

EXEC SP_LOG_STR @Aux
SET
	@Aux =(
		'Sdo Interes     : ' + COALESCE(dbo.TOCHAR(@Interes), 'NULL')
	);

EXEC SP_LOG_STR @Aux
SET
	@Aux =(
		'Sdo Ret IIGG    : ' + COALESCE(dbo.TOCHAR(@RetIIGG), 'NULL')
	);

EXEC SP_LOG_STR @Aux
SET
	@Aux =(
		'Sdo Ret IIBB    : ' + COALESCE(dbo.TOCHAR(@RetIIBB), 'NULL')
	);

EXEC SP_LOG_STR @Aux
SET
	@Aux =(
		'Sdo ITF         : ' + COALESCE(dbo.TOCHAR(@ITF), 'NULL')
	);

EXEC SP_LOG_STR @Aux
SET
	@Aux =(
		'Sdo EMBARGO     : ' + COALESCE(dbo.TOCHAR(@Embargo), 'NULL')
	);

EXEC SP_LOG_STR @Aux EXEC SP_LOG_STR ' '
SET
	@Aux =(
		'REG_ORDEN       : ' + COALESCE(dbo.TOCHAR(@RegOrden), 'NULL')
	);

EXEC SP_LOG_STR @Aux
END;

/* Actualizo los saldos en el registro procesado */
update
	xu_actualizacion_saldos
set
	monto = @Monto,
	concepto = @Concepto,
	s_capital = @Capital,
	s_interes = @Interes,
	s_ret_iigg = @RetIIGG,
	s_ret_iibb = @RetIIBB,
	s_itf = @ITF,
	s_embargo = @Embargo,
	reg_orden = @RegOrden,
	procesado = dbo.AHORA(),
	dia = dbo.FN_DATE_TO_CHAR(FECHA, 'DD/MM/YYYY')
where
	id_xu_actualizacion_saldo = @IdXuActualizacion;

/* Antes de pasar al siguiente registro me guardo la fecha que será, en el siguiente registro, la fecha del registro anterior */
IF @Tipo IN (1215, 1601, 1815) BEGIN
SET
	@FechaAntReg = @Fecha;

END
ELSE IF @Tipo = 1201 BEGIN
SET
	@FechaAntReg = @Fecha - (floor((@Fecha - @FechaAnt) / 86400)) * 86400;

END
ELSE IF @Tipo = 1801 BEGIN
SET
	@FechaAntReg = @Fecha - (floor((@Fecha - @FechaAnt) / 86400)) * 86400;

END
/* Me guardo el producto sobre el que se esta haciendo el calculo */
SET
	@EstaCuenta = @IdCSP;

FETCH NEXT
FROM
	REGISTROS_CCR INTO @IdXuActualizacion,
	@IdCSP,
	@Fecha,
	@Tipo,
	@TasaDiaria,
	@Monto,
	@SCapital,
	@SInteres,
	@SRetIigg,
	@SRetIibb,
	@SItf,
	@SEmbargo,
	@Concepto_cur,
	@RegOrden_cur
END;

CLOSE REGISTROS_CCR DEALLOCATE REGISTROS_CCR
/* Guardo los valores de la ultima deuda  */
update
	carpeta_sub_productos
set
	fecha_actual = @Hoy,
	capital_actual = @Capital + @Interes - @RetIIGG - @RetIIBB - @ITF - @Embargo
where
	id_carpeta_sub_producto = @EstaCuenta;

COMMIT;

END;

SP_XU_COMPUTAR_SALDO CREATE PROCEDURE [dbo].[SP_XU_COMPUTAR_SALDO] @ID_CSP int,
@Debug int AS BEGIN DECLARE @SALDO_ACTUAL FLOAT,
@SALDO_ANTERIOR FLOAT,
@REG_ORDEN INT,
@PROCESADO INT,
@MONTO FLOAT,
@ID_ACT_SALDO INT,
@TIPO INT
SET
	@PROCESADO = DBO.DateTime2ADVTime(GETDATE())
SET
	@REG_ORDEN = 1 DECLARE REGISTROS_CSP CURSOR GLOBAL FOR
SELECT
	SALDO_ACTUAL,
	MONTO,
	ID_XU_ACTUALIZACION_SALDO,
	TIPO
FROM
	XU_ACTUALIZACION_SALDOS
WHERE
	PROCESADO IS NULL
	AND ID_CARPETA_SUB_PRODUCTO = @ID_CSP OPEN REGISTROS_CSP FETCH REGISTROS_CSP INTO @SALDO_ACTUAL,
	@MONTO,
	@ID_ACT_SALDO,
	@TIPO
SET
	@SALDO_ANTERIOR = @SALDO_ACTUAL
	/*Mientras hayan datos en el cursor*/
	WHILE(@ @fetch_status = 0) BEGIN
SET
	@SALDO_ACTUAL = @SALDO_ANTERIOR + @MONTO
UPDATE
	XU_ACTUALIZACION_SALDOS
SET
	SALDO_ACTUAL = @SALDO_ACTUAL,
	REG_ORDEN = @REG_ORDEN,
	PROCESADO = @PROCESADO
WHERE
	PROCESADO IS NULL
	AND ID_XU_ACTUALIZACION_SALDO = @ID_ACT_SALDO
	AND ID_CARPETA_SUB_PRODUCTO = @ID_CSP
	AND TIPO = @TIPO
SET
	@SALDO_ANTERIOR = @SALDO_ACTUAL
	/*Si recibi DEBUG = 1, muestro detalles por consola.*/
	if (coalesce(@DEBUG, 0) = 1) begin
	/* Imprimo el ecanbezado d e este registro */
	print '---------------------------------------------' print 'ID_CSP          : ' + cast(@ID_CSP as varchar) print 'ID_XU_ACTUALIZACION_SALDO          : ' + cast(@ID_ACT_SALDO as varchar) print 'REG_ORDEN          : ' + cast(@REG_ORDEN as varchar) print 'Tipo            : ' + cast(@TIPO as varchar)
end
SET
	@REG_ORDEN = @REG_ORDEN + 1 FETCH REGISTROS_CSP INTO @SALDO_ACTUAL,
	@MONTO,
	@ID_ACT_SALDO,
	@TIPO
END CLOSE REGISTROS_CSP DEALLOCATE REGISTROS_CSP
END SP_XU_MOV_INTERCTA_IMPACTAR CREATE PROCEDURE [dbo].[SP_XU_MOV_INTERCTA_IMPACTAR] (@IdTramite int) AS BEGIN DECLARE @IdCspOrigen int,
@IdCspDestino int,
@Importe float,
@Cotizacion float,
@Descripcion varchar(4000)
/* Levantar datos del tramite */
select
	@IdCspOrigen = tra.id_carpeta_sub_producto,
	@IdCspDestino = dbo.TRAMITES_DECODIFICAR_PARAMETRO(tra.datos, 'CUENTA_DESTINO'),
	@Importe = dbo.FN_TRY_CAST_FLOAT(
		dbo.TRAMITES_DECODIFICAR_PARAMETRO(tra.datos, 'IMPORTE')
	),
	@Cotizacion = dbo.FN_TRY_CAST_FLOAT(
		dbo.TRAMITES_DECODIFICAR_PARAMETRO(tra.datos, 'COTIZACION')
	),
	@Descripcion = dbo.TRAMITES_DECODIFICAR_PARAMETRO(tra.datos, 'OBSERVACIONES')
from
	tramites tra
where
	tra.id_tramite = @IdTramite
	/* Inserto el primer movimiento para descontar el importe de la cuenta origen */
insert into
	xu_movimientos (
		fecha,
		monto,
		cod_producto,
		cuenta,
		observaciones,
		cod_moneda,
		audit_flags,
		audit_usuario,
		audit_fecha,
		fecha_proceso,
		id_rendicion,
		id_moneda,
		id_xu_csp,
		d1,
		d2,
		d3,
		cod_origen,
		cod_sucursal,
		cod_canal,
		id_xu_tipo_movimiento
	)
select
	dbo.AHORA() as fecha,
	@Importe * -1 as monto,
	null as cod_producto,
	xu.numero_cuenta as cuenta,
	@Descripcion as observaciones,
	m.letra as cod_moneda,
	null as audit_flags,
	tra.audit_usuario as audit_usuario,
	dbo.AHORA() as audit_fecha,
	dbo.AHORA() as fecha_proceso,
	null as id_rendicion,
	m.id_moneda as id_moneda,
	xu.id_xu_csp as id_xu_csp,
	dbo.FN_SET_PARAM('', 'ID_TRAMITE', tra.id_tramite) as d1,
	NULL as d2,
	NULL as d3,
	tra.numero as cod_origen,
	'CUENTA_CONTABLE' as cod_sucursal,
	null as cod_canal,
	xtm.id_xu_tipo_movimiento as id_xu_tipo_movimiento
from
	carpeta_sub_productos csp
	inner join xu_csp xu on xu.id_carpeta_sub_producto = csp.id_carpeta_sub_producto
	inner join monedas m on m.id_moneda = csp.id_moneda,
	xu_tipos_movimientos xtm,
	tramites tra
where
	1 = 1
	and csp.id_carpeta_sub_producto = @IdCspOrigen
	and tra.id_tramite = @IdTramite
	and xtm.codigo = 'MOV_INTERCUENTA' EXEC dbo.SP_XU_ACTUALIZAR_SALDOS @IdCspOrigen
	/* Inserto el segundo movimiento para acreditar el importe de la cuenta destino */
insert into
	xu_movimientos (
		fecha,
		monto,
		cod_producto,
		cuenta,
		observaciones,
		cod_moneda,
		audit_flags,
		audit_usuario,
		audit_fecha,
		fecha_proceso,
		id_rendicion,
		id_moneda,
		id_xu_csp,
		d1,
		d2,
		d3,
		cod_origen,
		cod_sucursal,
		cod_canal,
		id_xu_tipo_movimiento
	)
select
	dbo.AHORA() as fecha,
	(@Importe / @Cotizacion) as monto,
	null as cod_producto,
	xu.numero_cuenta as cuenta,
	@Descripcion as observaciones,
	m.letra as cod_moneda,
	null as audit_flags,
	tra.audit_usuario as audit_usuario,
	dbo.AHORA() as audit_fecha,
	dbo.AHORA() as fecha_proceso,
	null as id_rendicion,
	m.id_moneda as id_moneda,
	xu.id_xu_csp as id_xu_csp,
	dbo.FN_SET_PARAM('', 'ID_TRAMITE', tra.id_tramite) as d1,
	NULL as d2,
	NULL as d3,
	tra.numero as cod_origen,
	'CUENTA_CONTABLE' as cod_sucursal,
	null as cod_canal,
	xtm.id_xu_tipo_movimiento as id_xu_tipo_movimiento
from
	carpeta_sub_productos csp
	inner join xu_csp xu on xu.id_carpeta_sub_producto = csp.id_carpeta_sub_producto
	inner join monedas m on m.id_moneda = csp.id_moneda,
	xu_tipos_movimientos xtm,
	tramites tra
where
	1 = 1
	and csp.id_carpeta_sub_producto = @IdCspDestino
	and tra.id_tramite = @IdTramite
	and xtm.codigo = 'MOV_INTERCUENTA' EXEC dbo.SP_XU_ACTUALIZAR_SALDOS @IdCspDestino
END SP_XU_MOVIMIENTOS CREATE PROCEDURE [dbo].[SP_XU_MOVIMIENTOS] (
	@ID_CARPETA_SUB_PRODUCTO int,
	@ID_TRAMITE int,
	@MOV int
) as begin
/*@MOV son todas las operaciones que se le pueden realizar a los productos 
 de tipo Cuenta a la Vista 
 
 @MOV = 1 Deposito de Fondos
 @MOV = 2 Extracción de Fondos
 @MOV = 3 Ajuste de saldo
 @MOV = 4 Devolucion de embargo
 @MOV = 5 Ejecucion de embargo
 */
EXEC SP_XU_ACTUALIZAR_SALDOS @ID_CARPETA_SUB_PRODUCTO,
1,
1;

IF(@MOV = 1)
insert into
	xu_movimientos(
		nro_recibo,
		fecha,
		monto,
		cod_producto,
		cuenta,
		observaciones,
		cod_moneda,
		audit_flags,
		audit_usuario,
		audit_fecha,
		fecha_proceso,
		id_rendicion,
		id_moneda,
		id_xu_tipo_movimiento,
		id_xu_csp,
		d1,
		d2,
		d3,
		cod_origen,
		cod_sucursal,
		cod_canal
	)
select
	x.nro_recibo,
	x.fecha,
	x.monto,
	x.cod_producto,
	x.cuenta,
	x.observaciones,
	x.cod_moneda,
	x.audit_flags,
	x.audit_usuario,
	x.audit_fecha,
	x.fecha_proceso,
	null,
	x.tipo_moneda,
	x.id_xu_tipo_movimiento,
	x.id_xu_csp,
	x.d1,
	x.d2,
	x.d3,
	x.cod_origen,
	x.cod_sucursal,
	x.cod_canal
from
	(
		select
			null as nro_recibo,
			dbo.AHORA() as fecha,
			dbo.TONUMBER(
				dbo.TRAMITE_OBTENER_PARAMETRO(T.ID_TRAMITE, 'IMPORTE') * xtm.signo
			) as monto,
			p.id_producto as cod_producto,
			dbo.TRAMITE_OBTENER_PARAMETRO(T.ID_TRAMITE, 'NRO_CCR') as cuenta,
			'Deposito de Fondos' as observaciones,
			m.letra as cod_moneda,
			null as audit_flags,
			t.usuario_alta as audit_usuario,
			dbo.AHORA() as audit_fecha,
			dbo.AHORA() as fecha_proceso,
			null as id_rendicion,
			csp.id_moneda as tipo_moneda,
			xtm.id_xu_tipo_movimiento,
			id_xu_csp,
			null as d1,
			null as d2,
			null as d3,
			null as cod_origen,
			c.parametro as cod_sucursal,
			null as cod_canal
		from
			productos p,
			monedas m,
			xu_csp xucsp,
			configuracion c,
			carpeta_sub_productos csp,
			tramites t,
			xu_tipos_movimientos xtm,
			sub_productos sp
		where
			xtm.codigo = 'CREDITO'
			and xucsp.numero_cuenta = dbo.TRAMITE_OBTENER_PARAMETRO(T.ID_TRAMITE, 'NRO_CCR')
			and c.parametro = 'SUCURSAL'
			and csp.id_carpeta_sub_producto = t.id_carpeta_sub_producto
			and csp.id_sub_producto = sp.id_sub_producto
			and sp.id_producto = p.id_producto
			and m.id_moneda = csp.id_moneda
			and t.id_tramite = @ID_TRAMITE
	) x;

IF(@MOV = 2)
insert into
	xu_movimientos(
		nro_recibo,
		fecha,
		monto,
		cod_producto,
		cuenta,
		observaciones,
		cod_moneda,
		audit_flags,
		audit_usuario,
		audit_fecha,
		fecha_proceso,
		id_rendicion,
		id_moneda,
		id_xu_tipo_movimiento,
		id_xu_csp,
		d1,
		d2,
		d3,
		cod_origen,
		cod_sucursal,
		cod_canal
	)
select
	x.nro_recibo,
	x.fecha,
	x.monto,
	x.cod_producto,
	x.cuenta,
	x.observaciones,
	x.moneda,
	x.audit_flags,
	x.audit_usuario,
	x.audit_fecha,
	x.fecha_proceso,
	null,
	x.tipo_moneda,
	x.id_xu_tipo_movimiento,
	x.id_xu_csp,
	x.d1,
	x.d2,
	x.d3,
	x.cod_origen,
	x.cod_sucursal,
	x.cod_canal
from
	(
		select
			null as nro_recibo,
			dbO.AHORA() as fecha,
			dbo.TONUMBER(
				dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'IMPORTE')
			) * xtm.signo as monto,
			p.id_producto as cod_producto,
			dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'NRO_CCR') as cuenta,
			'Extracción de Fondos' as observaciones,
			m.letra as moneda,
			null as audit_flags,
			t.usuario_alta as audit_usuario,
			dbo.AHORA() as audit_fecha,
			dbo.AHORA() as fecha_proceso,
			null as id_rendicion,
			csp.id_moneda as tipo_moneda,
			xtm.id_xu_tipo_movimiento,
			id_xu_csp,
			null as d1,
			null as d2,
			null as d3,
			null as cod_origen,
			c.parametro as cod_sucursal,
			null as cod_canal
		from
			productos p,
			monedas m,
			xu_csp xucsp,
			configuracion c,
			carpeta_sub_productos csp,
			tramites t,
			xu_tipos_movimientos xtm,
			sub_productos sp
		where
			xtm.codigo = 'DEBITO'
			and xucsp.numero_cuenta = dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'NRO_CCR')
			and c.parametro = 'SUCURSAL'
			and csp.id_carpeta_sub_producto = t.id_carpeta_sub_producto
			and csp.id_sub_producto = sp.id_sub_producto
			and sp.id_producto = p.id_producto
			and m.id_moneda = csp.id_moneda
			and t.id_tramite = @ID_TRAMITE
	) x;

IF(@MOV = 3)
insert into
	xu_movimientos(
		nro_recibo,
		fecha,
		monto,
		cod_producto,
		cuenta,
		observaciones,
		cod_moneda,
		audit_flags,
		audit_usuario,
		audit_fecha,
		fecha_proceso,
		id_rendicion,
		id_moneda,
		id_xu_csp,
		d1,
		d2,
		d3,
		cod_origen,
		cod_sucursal,
		cod_canal,
		id_xu_tipo_movimiento
	)
select
	x.nro_recibo,
	x.fecha,
	x.monto,
	x.cod_producto,
	x.cuenta,
	x.observaciones,
	x.cod_moneda,
	x.audit_flags,
	x.audit_usuario,
	x.audit_fecha,
	x.fecha_proceso,
	null,
	x.tipo_moneda,
	x.id_xu_csp,
	x.d1,
	x.d2,
	x.d3,
	x.cod_origen,
	x.cod_sucursal,
	x.cod_canal,
	x.id_xu_tipo_movimiento
from
	(
		select
			null as nro_recibo,
			dbo.AHORA() as fecha,
			dbo.TONUMBER(
				dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'IMPORTE')
			) * xtm.signo as monto,
			p.id_producto as cod_producto,
			dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'NRO_CCR') as cuenta,
			dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'OBSERVACIONES') as observaciones,
			m.letra as cod_moneda,
			null as audit_flags,
			t.usuario_alta as audit_usuario,
			dbo.AHORA() as audit_fecha,
			dbo.AHORA() as fecha_proceso,
			null as id_rendicion,
			csp.id_moneda as tipo_moneda,
			id_xu_csp,
			null as d1,
			null as d2,
			null as d3,
			null as cod_origen,
			c.parametro as cod_sucursal,
			null as cod_canal,
			xtm.id_xu_tipo_movimiento
		from
			productos p,
			monedas m,
			xu_csp xucsp,
			configuracion c,
			carpeta_sub_productos csp,
			tramites t,
			xu_tipos_movimientos xtm,
			sub_productos sp
		where
			xucsp.numero_cuenta = dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'NRO_CCR')
			and c.parametro = 'SUCURSAL'
			and csp.id_carpeta_sub_producto = t.id_carpeta_sub_producto
			and csp.id_sub_producto = sp.id_sub_producto
			and sp.id_producto = p.id_producto
			and m.id_moneda = csp.id_moneda
			and t.id_tramite = @id_tramite
			and xtm.id_xu_tipo_movimiento = dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'TIPO')
	) x;

IF(@MOV = 4)
insert into
	xu_movimientos(
		nro_recibo,
		fecha,
		monto,
		cod_producto,
		cuenta,
		observaciones,
		cod_moneda,
		audit_flags,
		audit_usuario,
		audit_fecha,
		fecha_proceso,
		id_rendicion,
		id_moneda,
		id_xu_tipo_movimiento,
		id_xu_csp,
		d1,
		d2,
		d3,
		cod_origen,
		cod_sucursal,
		cod_canal
	)
select
	x.nro_recibo,
	x.fecha,
	x.monto,
	x.cod_producto,
	x.cuenta,
	x.observaciones,
	x.cod_moneda,
	x.audit_flags,
	x.audit_usuario,
	x.audit_fecha,
	x.fecha_proceso,
	null,
	x.tipo_moneda,
	x.id_xu_tipo_movimiento,
	x.id_xu_csp,
	x.d1,
	x.d2,
	x.d3,
	x.cod_origen,
	x.cod_sucursal,
	x.cod_canal
from
	(
		select
			null as nro_recibo,
			dbo.AHORA() as fecha,
			dbo.TONUMBER(
				dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'IMPORTE')
			) * xtm.signo as monto,
			p.id_producto as cod_producto,
			dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'NRO_CCR') as cuenta,
			'Devolucion de Embargo' as observaciones,
			m.letra as cod_moneda,
			null as audit_flags,
			t.usuario_alta as audit_usuario,
			dbo.AHORA() as audit_fecha,
			dbo.AHORA() as fecha_proceso,
			null as id_rendicion,
			csp.id_moneda as tipo_moneda,
			xtm.id_xu_tipo_movimiento,
			id_xu_csp,
			null as d1,
			dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'OBSERVACIONES') as d2,
			dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'NRO_OFICIO') as d3,
			null as cod_origen,
			c.parametro as cod_sucursal,
			null as cod_canal
		from
			productos p,
			monedas m,
			xu_csp xucsp,
			configuracion c,
			carpeta_sub_productos csp,
			tramites t,
			xu_tipos_movimientos xtm,
			sub_productos sp
		where
			xtm.codigo = 'DEV-EMBARGO'
			and xucsp.numero_cuenta = dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'NRO_CCR')
			and c.parametro = 'SUCURSAL'
			and csp.id_carpeta_sub_producto = t.id_carpeta_sub_producto
			and csp.id_sub_producto = sp.id_sub_producto
			and sp.id_producto = p.id_producto
			and m.id_moneda = csp.id_moneda
			and t.id_tramite = @ID_TRAMITE
	) x;

IF(@MOV = 5)
insert into
	xu_movimientos(
		nro_recibo,
		fecha,
		monto,
		cod_producto,
		cuenta,
		observaciones,
		cod_moneda,
		audit_flags,
		audit_usuario,
		audit_fecha,
		fecha_proceso,
		id_rendicion,
		id_moneda,
		id_xu_csp,
		id_xu_tipo_movimiento,
		d1,
		d2,
		d3,
		cod_origen,
		cod_sucursal,
		cod_canal
	)
select
	x.nro_recibo,
	x.fecha,
	x.monto,
	x.cod_producto,
	x.cuenta,
	x.observaciones,
	x.cod_moneda,
	x.audit_flags,
	x.audit_usuario,
	x.audit_fecha,
	x.fecha_proceso,
	null,
	x.tipo_moneda,
	x.id_xu_csp,
	x.id_xu_tipo_movimiento,
	x.d1,
	x.d2,
	x.d3,
	x.cod_origen,
	x.cod_sucursal,
	x.cod_canal
from
	(
		select
			null as nro_recibo,
			dbo.AHORA() as fecha,
			dbo.TONUMBER(
				dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'IMPORTE')
			) * xtm.signo as monto,
			P.ID_PRODUCTO as cod_producto,
			dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'NRO_CCR') as cuenta,
			'Ejecucion de embargo' as observaciones,
			m.letra as cod_moneda,
			null as audit_flags,
			t.usuario_alta as audit_usuario,
			dbo.AHORA() as audit_fecha,
			dbo.AHORA() as fecha_proceso,
			null as id_rendicion,
			csp.id_moneda as tipo_moneda,
			id_xu_csp,
			xtm.id_xu_tipo_movimiento,
			null as d1,
			dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'NRO_OFICIO') as d2,
			dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'OBSERVACIONES') as d3,
			null as cod_origen,
			c.parametro as cod_sucursal,
			null as cod_canal
		from
			productos p,
			monedas m,
			xu_csp xucsp,
			configuracion c,
			carpeta_sub_productos csp,
			tramites t,
			xu_tipos_movimientos xtm,
			sub_productos sp
		where
			xucsp.numero_cuenta = dbo.TRAMITE_OBTENER_PARAMETRO(@ID_TRAMITE, 'NRO_CCR')
			and c.parametro = 'SUCURSAL'
			and csp.id_carpeta_sub_producto = t.id_carpeta_sub_producto
			and csp.id_sub_producto = sp.id_sub_producto
			and sp.id_producto = p.id_producto
			and m.id_moneda = csp.id_moneda
			and xtm.codigo = 'EMBARGO'
			and t.id_tramite = @ID_TRAMITE
	) x;

EXEC SP_XU_ACTUALIZAR_SALDOS @ID_CARPETA_SUB_PRODUCTO,
1,
1;

END