# Dominio — Cuenta Corriente (módulo opcional XCC)

> **Estado: implementado** (Fases 1 a 3b — fundación de core, tablas del módulo, motor de cálculo, retenciones). Pendiente: Fase 4 (ABMs), ver `docs/open-issues.md`. Este documento describe el sistema tal como quedó implementado, no un plan.

Módulo opcional (`packages/modules/cuenta-corriente`, prefijo `XCC_`, ver ADR 0012/0020) que traduce a este proyecto un sistema de cuenta corriente con devengamiento de interés que corre en producción en un legacy SQL Server. La lógica financiera (qué devenga, qué se acredita, qué se retiene, y que un movimiento con fecha pasada recalcule correctamente todo lo posterior) se mantiene equivalente al legacy — lo que cambia es cómo está escrita.

## Principios de diseño (evitando los problemas del legacy)

Relevado contra el legacy real (`docs/runbooks/archivos de apoyo/tablas cuenta corriente.txt` + `procesos cuenta corriente.sql`):

- **Nada de números mágicos de tipo con lógica en `IF/ELSE`** dentro del motor (el legacy tiene ~25 ramas `IF @Tipo = 1101...`). El comportamiento de cada tipo de asiento es dato (`XCC_TIPOS_MOVIMIENTOS`), no código — incluidos los asientos que genera el motor solo (apertura, devengamiento, acreditación, cierre, retención).
- **Un solo motor de cálculo**, no dos copias que divergen (el legacy tiene `SP_XU_ACTUALIZAR_1CA_MENS`/`SP_XU_ACTUALIZAR_1CCR_MENS`, casi idénticas, con fixes aplicados a una y no a la otra).
- **Fechas con tipos reales** (`timestamptz`, precisión real de hora — no enteros `ADVTIME` con aritmética de `+86400`).
- **Sin tablas `_HIST` duplicando el schema completo** — snapshots con fecha de vigencia (mismo patrón que `COTIZACIONES`), solo para los campos que de verdad necesitan resolverse "a una fecha".
- **Sin alícuotas hardcodeadas** en el motor (el legacy tiene `0.006` de ITF escrito directo en el SP) — todo lo que puede cambiar por ley vive en una tabla editable por ABM.
- **Sin recompute por cursor fila-por-fila con detección de "saltos"** (`REG_ORDEN` del legacy) — la fecha desde la que hay que recalcular siempre se conoce de entrada (es la fecha de lo que acaba de cambiar), nunca hace falta inferirla comparando filas.

## Cambios en el core (no exclusivos de XCC)

- `PRODUCTOS` → `CATEGORIAS_PRODUCTOS`, `SUB_PRODUCTOS` → `PRODUCTOS` (rename), con `CUENTAS.ID_PRODUCTO` repunteado al nivel específico (antes apuntaba mal, al nivel de categoría).
- `CATEGORIAS_PRODUCTOS.MODULO = 'XCC'` para la categoría "Cuentas"; `CATEGORIAS_PRODUCTOS.SP_PAGO`/`SP_ANULAR_PAGO` (nombre de SP invocado dinámicamente por un motor genérico de pagos, mismo patrón que `ACCIONES.COMANDO`).
- Tablas nuevas genéricas: `ENTES`, `FORMAS_PAGO`, `FORMAS_DESEMBOLSO`, `CANALES_PAGO`/`CANALES_DESEMBOLSO` (vínculo con `ENTES`), `PRODUCTOS_CANALES_PAGO`/`PRODUCTOS_CANALES_DESEMBOLSO`.
- `TIPOS_FERIADO`/`FERIADOS` + `fn_es_dia_habil` (`packages/db/sql/`) — genéricas, cualquier módulo futuro que necesite día hábil las puede usar. Los 4 `TIPOS_FERIADO` son catálogo real; las filas de `FERIADOS` hoy son solo datos de prueba (ver `docs/open-issues.md`).
- Motor de estados wireado por primera vez sobre `CUENTAS` (Iniciada/Abierta/Cerrada).

## Tablas del módulo

- **`XCC_PRODUCTOS`** — extensión 1:1 de `PRODUCTOS`: tasa de interés default, saldo mínimo para generar interés, gasto mensual.
- **`XCC_CUENTAS`** — extensión 1:1 de `CUENTAS`: overrides opcionales sobre el producto, `TASA_INTERES` vigente denormalizada (la fuente de verdad histórica es `XCC_CUENTAS_TASA_HISTORICO`).
- **`XCC_CUENTAS_TASA_HISTORICO`** — `ID_CUENTA`, `TASA`, `VIGENTE_DESDE`, `ALTA_FECHA`. Se resuelve a nivel cuenta, no producto (igual que el legacy) — un solo histórico cubre override propio o herencia del producto.
- **`XCC_CLIENTES`** — extensión 1:1 de `CLIENTES`: condición impositiva vigente denormalizada.
- **`XCC_CONDICIONES_IMPOSITIVAS`** — catálogo editable: `CODIGO`, `NOMBRE`, `ALICUOTA_GANANCIAS`.
- **`XCC_CLIENTES_CONDICION_HISTORICO`** — `ID_CLIENTE`, `ID_CONDICION_IMPOSITIVA`, `VIGENTE_DESDE`, `ALTA_FECHA` — necesaria porque un recompute retroactivo puede alcanzar una acreditación ya procesada, y la retención de Ganancias de ese día tiene que resolverse con la condición vigente EN ESE MOMENTO, no la actual.
- **`XCC_TIPOS_MOVIMIENTOS`** — catálogo único para todo tipo de asiento (no solo movimientos manuales): `CODIGO`, `SIGNO`, `AFECTA_CAPITAL`, `ORDEN`, `GENERADO_POR_MOTOR` (distingue lo que un usuario puede elegir al cargar un movimiento manual de lo que solo genera el motor: apertura, devengamiento, acreditación, cierre, retención, checkpoint).
- **`XCC_MOVIMIENTOS`** — el movimiento manual real: `ID_CUENTA`, `ID_TIPO_MOVIMIENTO`, `FECHA` (timestamptz), `MONTO`, `ALTA_FECHA`, `ID_TRAMITE` nullable (trazabilidad si se originó por un trámite).
- **`XCC_TIPOS_RETENCION`** — catálogo editable: `CODIGO`, `ORDEN`, `ACTIVA`, `ALICUOTA`, `USA_CONDICION_IMPOSITIVA` (columna de dato, no un `CODIGO` comparado en el motor).
- **`XCC_SALDOS`** — el libro mayor calculado: `ID_CUENTA`, `FECHA`, `ID_TIPO_MOVIMIENTO` (no nullable, todo asiento se clasifica), `ID_XCC_MOVIMIENTO` nullable (null para asientos generados por el motor), `ID_TIPO_RETENCION` nullable, `SALDO_CAPITAL`, `SALDO_INTERES`, `TASA_APLICADA`.
- **`XCC_CHECKPOINT`** — "a esta fecha, la cuenta tiene estos saldos, recalculá todo lo posterior desde acá": `ID_CUENTA`, `FECHA`, `SALDO_CAPITAL`, `SALDO_INTERES`, `ALTA_FECHA`. Sirve tanto para importar una cuenta de otro sistema como para corregir a mano en cualquier momento de su vida.
- **`XCC_RECALCULO_PENDIENTE`** — cola de recálculo (ver "Disparo y cola" abajo): `ID_CUENTA` único, `FECHA_DESDE`.

Deliberadamente no traducidas del legacy: `XU_SISTEMAS` (trackeo multi-sistema que no aplica acá), `XU_TIPOS_CUENTA_HIST`/`XU_CSP_HISTORICO` (reemplazadas por los históricos con fecha de vigencia de arriba).

## Motor de cálculo (`sp_xcc_recalcular_cuenta`)

`packages/modules/cuenta-corriente/sql/` (aplicado a mano, ver su `README.md`). Función PL/pgSQL con loop día a día (no una función de ventana pura — la capitalización mensual resetea el interés acumulado periódicamente, algo que una sola `SUM() OVER` no expresa limpio).

**Algoritmo:**

1. Busca el último punto conocido-bueno antes de la fecha de corte (última fila de `XCC_SALDOS` o `XCC_CHECKPOINT`, lo que sea más reciente). Si no hay ninguno, arranca en `ALTA_FECHA` de la cuenta con saldos en 0, genera el asiento `apertura`, y aplica ahí mismo cualquier `XCC_MOVIMIENTOS` fechado ese mismo día (ver bug de apertura abajo). Sin devengamiento propio ese día — es el punto de referencia.
2. Recorre día por día (`generate_series`) desde ahí hasta hoy:
   - Si es día 1 de mes y hay interés acumulado: lo capitaliza (`acreditacion_intereses`, `saldo_capital += saldo_interes`) — corre siempre primero en el día, aplica retenciones (ver abajo) sobre ese interés bruto.
   - Checkpoints y `XCC_MOVIMIENTOS` de ese día, ordenados por `ORDEN` de `XCC_TIPOS_MOVIMIENTOS` primero, `FECHA` real solo como desempate dentro del mismo tipo (ver "Orden dentro del día" abajo).
   - Todo esto se procesa antes de devengar el interés de ese mismo día — un depósito de hoy ya devenga hoy.
   - Si es día hábil (`fn_es_dia_habil`, sobre `FERIADOS`/fin de semana): devenga `saldo_capital * tasa_vigente / 100 / 365 * días_transcurridos_desde_el_último_devengamiento` — cubriendo de una sola vez el hueco de fines de semana/feriados (un solo tipo de asiento, no la separación hábil/inhábil del legacy; mismo total acumulado).
3. Al llegar a hoy, si la cuenta está `cerrada` y no tiene ya un asiento `cierre`, capitaliza el interés pendiente (con sus retenciones) y cierra.

### Retenciones (`fn_xcc_aplicar_retenciones`)

Invocada desde los dos puntos de acreditación (capitalización mensual y cierre) — un solo lugar con la lógica, no duplicada. Verificado contra el legacy real: cada retención se calcula sobre el **interés bruto**, sin cascada (`@ITF = @ITF + @Interes * 0.006`, `@RetIIGG = ... FN_XU_RETENCION(..., @Interes, ...)` — ambas usan el bruto, nunca un acumulador ya descontado por otra retención).

Recorre `XCC_TIPOS_RETENCION WHERE activa ORDER BY orden`:
- `USA_CONDICION_IMPOSITIVA = false` (alícuota fija, ej. ITF) → usa `ALICUOTA` directo.
- `USA_CONDICION_IMPOSITIVA = true` (ej. Ganancias) → resuelve el titular del legajo (`CLIENTES.ES_TITULAR = true`, garantizado único por legajo vía trigger) y su `XCC_CLIENTES_CONDICION_HISTORICO` vigente a la fecha del asiento.
- Cliente sin condición impositiva cargada, o cuenta sin titular todavía → alícuota `0`, no rompe el recálculo de toda la cuenta por un dato faltante.
- Por cada retención con monto > 0, genera un asiento `retencion` con `ID_TIPO_RETENCION` (trazabilidad) y monto negativo.
- Instalación sin retenciones activas → el motor no cambia, simplemente no genera esos asientos.

### Bugs reales encontrados y corregidos (verificación con suite de 54 casos scratch)

- **Movimiento del día de apertura perdido**: el loop principal arranca en `ALTA_FECHA + 1`, así que sin manejar el día de apertura aparte, un `XCC_MOVIMIENTOS` fechado ese mismo día se perdía en silencio. Corregido aplicando los movimientos de apertura en el paso 1, antes de entrar al loop.
- **Checkpoint perdido a mitad de recorrido**: originalmente `XCC_CHECKPOINT` solo se consultaba una vez, al buscar el punto de partida. Si el pendiente encolado tenía una `FECHA_DESDE` más vieja que un checkpoint cargado después (caso típico: migrar una cuenta, crearla, y antes de que la cola drene cargarle el checkpoint con el saldo importado), ese checkpoint nunca se llegaba a ver — se perdía en silencio. Corregido consultando `XCC_CHECKPOINT` en cada día del recorrido, no solo al inicio.
- **Orden checkpoint-vs-movimiento dentro del mismo día (dos correcciones, la primera mal)**: la primera versión comparaba solo `FECHA::date`, poniendo el checkpoint siempre primero sin mirar la hora. Una segunda corrección lo cambió a orden cronológico real (`FECHA` completa) asumiendo que la hora del checkpoint importaba — **esa corrección resultó estar mal, sin verificar contra el legacy**. El legacy real ordena su cursor `ORDER BY día, TIPO, fecha`: la migración (`TIPO 1102`) va siempre justo después de apertura (`1101`), sin importar a qué hora se cargó — el checkpoint representa "el saldo al INICIO del día calendario", no "al momento exacto en que se cargó". Se corrigió usando `ORDEN` de `XCC_TIPOS_MOVIMIENTOS` como criterio primario (con `checkpoint` en `ORDEN=6`, antes de los movimientos manuales en `10+`), y `FECHA` real solo como desempate dentro del mismo tipo — esto replica el comportamiento del legacy exactamente.
- **No-determinismo en desempates**: varias consultas resolvían "la fila vigente a una fecha" con `ORDER BY <fecha> DESC LIMIT 1` sin desempate — si dos filas compartían exactamente la misma fecha (ej. una corrección de tasa con la misma `VIGENTE_DESDE`), el resultado no era determinístico entre recomputaciones, algo inaceptable en un libro mayor. Se agregó `ALTA_FECHA` (default `now()`) a los históricos/movimientos/checkpoint, y las consultas afectadas desempatan por `ALTA_FECHA DESC NULLS LAST, ID DESC`.

**Simplificaciones explícitas aceptadas** (no son "menos correcto", son decisiones de diseño distintas del legacy):
- Días inhábiles no generan un tipo de asiento separado (se acumulan en el próximo devengamiento hábil).
- `fn_es_dia_habil` trata cualquier fila en `FERIADOS` como no-hábil, sin distinguir por `TIPOS_FERIADO`.
- Un checkpoint consumido como punto de partida inicial no genera su propio asiento visible en `XCC_SALDOS` (solo lo hace si aparece en medio del recorrido) — los saldos son correctos en ambos casos, es una cuestión de trazabilidad del ledger, no de exactitud.

## Disparo y cola (`XCC_RECALCULO_PENDIENTE`)

Los triggers `AFTER INSERT` en `XCC_MOVIMIENTOS`/`XCC_CUENTAS_TASA_HISTORICO`/`XCC_CHECKPOINT` **no llaman al motor directo** — encolan en `XCC_RECALCULO_PENDIENTE` vía `INSERT ... ON CONFLICT (ID_CUENTA) DO UPDATE SET FECHA_DESDE = LEAST(...)` (dedup: si ya hay un pendiente para esa cuenta, se queda con la fecha más antigua de las dos). Motivo: una corrección retroactiva vieja puede disparar un recálculo de miles de días — hacerlo síncrono dentro de la transacción del `INSERT` bloquearía a quien lo cargó, y una carga masiva (importar el histórico de una cuenta) dispararía ese recálculo completo una vez por cada fila insertada (cuadrático).

**100% base de datos** — se evaluó y se descartó un worker de Node con `pg_notify`/`LISTEN` (mismo patrón que `ACCIONES_EXTERNAS_COLA`, ver `domain/acciones-externas.md`): ese patrón se justifica ahí porque Postgres no puede mandar un mail ni pegarle a un webhook — acá el recálculo es SQL/PL-pgSQL puro, Postgres lo puede hacer solo, y agregar Node contradiría el principio explícito de ADR 0015 ("el disparo corre en `pg_cron`, no en la aplicación").

Dos `PROCESO`s (mismo mecanismo que `domain/procesos.md`) interactúan con la cola:
- **`xcc_consolidacion_saldos`** (`0 2 * * *`, 2am): encola toda cuenta XCC `abierta` — cubre las que no tuvieron ningún movimiento/trigger en un tiempo y quedaron atrasadas (el loop día-a-día siempre avanza hasta hoy, pero nada lo dispara si no hay movimientos nuevos). Solo `abierta`, nunca `cerrada` (ya generó su asiento `cierre` congelado). Barata: solo encola, nunca llama al motor.
- **`xcc_procesar_recalculos_pendientes`** (`*/2 * * * *`): su único paso es `CALL sp_xcc_drenar_recalculos_pendientes()` — el único lugar que efectivamente llama al motor.

`sp_xcc_drenar_recalculos_pendientes` recorre la cola con un loop PL/pgSQL y llama `CALL sp_xcc_recalcular_cuenta(...)` por cada fila **dentro de su propio `BEGIN ... EXCEPTION WHEN OTHERS ... END`**: si una cuenta tira excepción, hace rollback solo a su propio savepoint y sigue con la próxima — las demás cuentas de la pasada no se ven afectadas, y la rota deja su fila pendiente sin borrar (se reintenta sola la próxima pasada). `sp_xcc_recalcular_cuenta` es `PROCEDURE`, no `FUNCTION` — no maneja su propia transacción, el recálculo de una cuenta es atómico (todo o nada).

## Dónde vive cada pieza

- Schema: `packages/modules/cuenta-corriente/src/schema.ts`.
- SQL manual (ver su `README.md`): `packages/modules/cuenta-corriente/sql/0001` a `0005` (tasa vigente, aplicar retenciones, motor, triggers, drenado de cola).
- Seed: `packages/modules/cuenta-corriente/src/seed.ts` (catálogos, los dos `PROCESO`s) y `seed-demo.ts` (cuentas de demo).
- Core: `packages/db/src/schema.ts` (rename de productos, canales de pago, `TIPOS_FERIADO`/`FERIADOS`), `packages/db/sql/` (`fn_es_dia_habil`).

Pendiente (Fase 4): ABMs de `XCC_TIPOS_MOVIMIENTOS`, `XCC_TIPOS_RETENCION`, `XCC_CONDICIONES_IMPOSITIVAS` y gestión de cuentas — ver `docs/open-issues.md`.
