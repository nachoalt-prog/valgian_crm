# SQL manual

Migraciones SQL manuales del motor de cálculo de Cuenta Corriente (funciones + procedures + triggers, PL/pgSQL) — Drizzle no puede generar esto, solo DDL de tablas. Mismo criterio que `packages/db/sql/` (ver ese README), pero propio del módulo, aplicado contra la MISMA base Postgres del cliente (ADR 0020).

**Requiere haber aplicado antes** `packages/db/sql/0020_fn_es_dia_habil.sql` (función genérica del core, no de este módulo — `sp_xcc_recalcular_cuenta` la usa).

Se aplican a mano contra la base (no hay corredor automático todavía):

```sh
psql "$DATABASE_URL" -f sql/0001_fn_xcc_tasa_vigente.sql
```

## Archivos

- `0001_fn_xcc_tasa_vigente.sql`: función que resuelve la tasa de interés vigente de una cuenta a una fecha dada, desde `XCC_CUENTAS_TASA_HISTORICO`.
- `0002_fn_xcc_aplicar_retenciones.sql`: aplica las retenciones activas (`XCC_TIPOS_RETENCION`) sobre un interés bruto ya acreditado — invocada desde `sp_xcc_recalcular_cuenta` en sus dos puntos de acreditación (ver `docs/domain/cuenta-corriente.md`).
- `0003_sp_xcc_recalcular_cuenta.sql`: el motor — recalcula `XCC_SALDOS` de una cuenta desde una fecha en adelante (capital, devengamiento, acreditación mensual, retenciones, cierre). `PROCEDURE`, no `FUNCTION` — el único que la invoca es `sp_xcc_drenar_recalculos_pendientes` (`0005_...`), vía `CALL`. Usa `fn_es_dia_habil` del core y `fn_xcc_aplicar_retenciones`.
- `0004_trigger_xcc_recalcular.sql`: triggers que **encolan** en `XCC_RECALCULO_PENDIENTE` al insertar en `XCC_MOVIMIENTOS`, `XCC_CUENTAS_TASA_HISTORICO`, o `XCC_CHECKPOINT` — nunca llaman a `sp_xcc_recalcular_cuenta` directo (un recálculo retroactivo viejo puede recorrer miles de días; hacerlo síncrono en la transacción del `INSERT` bloquearía a quien lo cargó, y una carga masiva dispararía ese recálculo una vez por cada fila insertada).
- `0005_sp_xcc_drenar_recalculos_pendientes.sql`: recorre `XCC_RECALCULO_PENDIENTE` con un loop PL/pgSQL, `CALL sp_xcc_recalcular_cuenta(...)` por cada fila dentro de su propio `BEGIN/EXCEPTION/END` (una cuenta rota no bloquea a las demás — ver comentario del archivo). Invocada por el proceso `xcc_procesar_recalculos_pendientes` (`packages/modules/cuenta-corriente/src/seed.ts`, cron cada 2 min) — es el ÚNICO lugar que efectivamente llama al motor. El proceso `xcc_consolidacion_saldos` (2am) solo encola las cuentas abiertas sin movimientos recientes en la misma cola, no llama al motor directo.
- `0006_trigger_xcc_condicion_historico.sql`: encola recálculo al insertar en `XCC_CLIENTES_CONDICION_HISTORICO` — mismo espíritu que los triggers de `0004_...`, pero puede encolar VARIAS cuentas (todas las del cliente donde es titular), no una sola.
- `0007_fn_xcc_aplicar_retenciones_condicion_retencion.sql`: `CREATE OR REPLACE` de `fn_xcc_aplicar_retenciones` (`0002_...`) — cambia la resolución de alícuota "por condición impositiva" de una columna 1:1 (`XCC_CONDICIONES_IMPOSITIVAS.ALICUOTA_GANANCIAS`) a la tabla N:M `XCC_CONDICIONES_RETENCION` (override explícito por par condición/tipo de retención, con `XCC_TIPOS_RETENCION.ALICUOTA` como default si no hay override).

100% base de datos (`pg_cron`/`PROCESOS`, sin componente de aplicación) — ver `docs/domain/cuenta-corriente.md` para el porqué (`pg_cron` no tiene un primitivo de "ejecutar esto una vez, ahora" por evento; ver también ADR 0015).
