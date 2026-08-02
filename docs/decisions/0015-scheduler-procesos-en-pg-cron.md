# 0015 - El scheduler de Procesos corre en `pg_cron`, no en Node

## Estado

Aceptada — implementada (ver `domain/procesos.md`).

## Contexto

Se necesitan procesos periódicos automáticos: un `PROCESO` configurado dispara según un horario (ej. "todos los días a la 1am"), puede fallar y reintentarse, y necesita dejar auditoría de cada corrida. A diferencia de Bandejas/Reportes/Placeholders (SQL de confianza disparado por una acción del usuario o del motor de estados), acá lo que dispara la ejecución es el **paso del tiempo**, no un evento de la aplicación.

La primera pregunta fue "¿un job nativo de la base (como el Scheduler de SQL Server/Oracle) o un timer del lado de Node?".

## Decisión

**`pg_cron`**, no Node. Con dos piezas concretas:

1. **1 job evaluador**, liviano, registrado una única vez (`SELECT cron.schedule('ticker_procesos_evaluador', '* * * * *', 'CALL sp_evaluar_procesos()')`), corre cada minuto: por cada `PROCESO` activo cuyo `CRON` matchea el instante actual (en el timezone de la instalación, ver más abajo), inserta una fila en `PROCESOS_EJECUCIONES` (`ON CONFLICT DO NOTHING` sobre `(ID_PROCESO, FECHA_PROGRAMADA)` para deduplicar). Nunca ejecuta lógica de negocio — solo decide "a quién le toca".
2. **N jobs ejecutores**, idénticos entre sí, también registrados una única vez, cada uno reclama con `FOR UPDATE SKIP LOCKED` una fila pendiente vencida y la corre paso a paso (ver `domain/procesos.md` para el detalle de `PROCESOS_PASOS`).

Se corrige acá una recomendación equivocada de una iteración anterior de este mismo diseño: se había descartado `pg_cron` por analogía con `pg_net` (extensión ya descartada para llamadas HTTP async desde Postgres, ver `domain/generacion-documentos.md`). Verificado con búsqueda real: `pg_net` y `pg_cron` NO son comparables en portabilidad — `pg_cron` está soportado nativamente en AWS RDS/Aurora, Azure Database for PostgreSQL y Google Cloud SQL (además de Supabase/Neon), es la extensión estándar de facto para scheduling en Postgres. La analogía inicial fue un error, corregido antes de comprometer el diseño.

### Por qué un solo job no alcanza

Verificado también: `pg_cron` nunca corre dos instancias del **mismo** job en simultáneo — si un job sigue corriendo cuando le toca el próximo disparo, el próximo espera en cola. Un solo job haciendo evaluación + ejecución completo significa que un paso lento (los hay, de hasta ~50 minutos según casos reales esperados) bloquea la evaluación y ejecución de **todos** los demás `PROCESOS` durante ese tiempo. Separar evaluador (siempre liviano, nunca bloqueado) de N ejecutores (jobs distintos de `pg_cron`, sí corren en paralelo entre sí) resuelve esto sin salir del ecosistema de `pg_cron`.

Con paralelismo real entre ejecutores, un guard que antes era gratis deja de serlo: hace falta chequear explícitamente que no haya ya otra ejecución `procesando` del mismo `ID_PROCESO` antes de reclamar una fila — con un solo job serializado esto era estructuralmente imposible, con N ejecutores no lo es.

### Configuración de conexión

`pg_cron` por default abre una conexión `libpq` nueva por cada ejecución de job (consume `max_connections`, requiere permiso en `pg_hba.conf`). Con N ejecutores tickeando cada minuto, eso es presión constante sobre el mismo límite de conexiones que ya le costó al proyecto (`packages/db/src/client.ts` cachea el pool en `globalThis` justamente por problemas previos de "too many clients already"). Se configura **`cron.use_background_workers = on`**: los jobs corren como workers internos de Postgres, no como conexiones `libpq` externas — no compiten por `max_connections`, no dependen de `pg_hba.conf`. El límite pasa a ser `max_worker_processes`/`cron.max_running_jobs`, a dimensionar con margen sobre `1 + N`.

### Reintentos — por qué no viven en `pg_cron` tampoco

El reintento con backoff (reintentar en `X` minutos, por fuera de la corrida oficial, con tope de intentos) es orquestación con estado — no algo que `pg_cron` resuelva nativamente (su unidad es "corré esto en este horario fijo", no "reprogramate solo a una hora calculada en runtime"). Se resuelve con datos, no con más jobs: al fallar una ejecución, el mismo código que la marca `error` inserta una fila nueva en `PROCESOS_EJECUCIONES` con `FECHA_PROGRAMADA = ahora + REINTENTO_MINUTOS` — el mecanismo de claim de los ejecutores no distingue entre una corrida oficial y un reintento, son la misma cola.

### Zona horaria

`cron.timezone` es config de infraestructura **por instalación** (mismo criterio que ADR 0013: "config de infraestructura por instalación → vive fuera de la tabla de negocio"), no una columna de `PROCESOS`. Se documenta como principio general, no exclusivo de Procesos: toda hora que maneje una instalación de este sistema es la hora local de ESA instalación — si mañana hay un cliente en Europa, sus horarios son los suyos, no los de Argentina.

## Alternativas consideradas

- **Timer in-process en Node** (`setInterval` en `instrumentation-node.ts`, mismo archivo que ya orquesta el worker de `GENERACIONES_DOCUMENTO`): descartado. No sobrevive un restart/deploy de la app — si el horario programado cae justo en medio de un deploy, se pierde ese disparo sin un mecanismo de reconciliación aparte. Menos consistente con ADR 0009 (lógica de negocio configurable vive en SQL). La ventaja que tenía (evitar depender de una extensión de Postgres) se cae al confirmar que `pg_cron` sí es ampliamente portable.
- **Un job de `pg_cron` por `PROCESO`** (`cron.schedule()` individual por fila, gestionado desde el ABM): descartado — obliga a sincronizar dos fuentes de verdad (la tabla `PROCESOS` y el registro interno `cron.job`) en cada alta/baja/edición desde el ABM. El diseño de "un solo evaluador liviano que lee `PROCESOS` directo" evita esa sincronización por completo.
- **Reintento evaluado de forma perezosa** (el ticker de cada minuto escanea `PROCESOS_EJECUCIONES` buscando fallos vencidos, en vez de programar el reintento en el momento del fallo): descartado — exige una verificación extra no trivial ("¿ya generé un reintento para ESTA falla o no?") para no disparar el mismo reintento dos veces. Programar la fila de reintento una única vez, en el momento exacto del fallo, es más simple y no tiene esa ventana de duplicación.
- **Toggle en caliente del scheduler desde la app** (un flag que la SP consulta antes de hacer cualquier trabajo): descartado por ahora a favor de `cron.unschedule()`/`cron.schedule()` como operación de infraestructura por instalación (setup/ops, no runtime) — consistente con ADR 0013. Se puede reconsiderar si en la práctica hace falta pausar sin acceso a consola SQL.

## Consecuencias

- Requiere escribir una función PL/pgSQL de "¿esta expresión cron matchea este timestamp?" — no viene con Postgres ni con `pg_cron` como función invocable.
- La ejecución real de cada paso (y su commit) vive en PL/pgSQL, dentro de una `PROCEDURE` (no una `FUNCTION` — necesita controlar sus propias transacciones para hacer commit paso a paso).
- Hace falta un barrido de filas `procesando` huérfanas (Postgres se cae a mitad de una ejecución) — cuenta como intento fallido contra `REINTENTOS_MAX`, no es un reintento gratis.
- `cron.use_background_workers = on` y el dimensionamiento de `cron.max_running_jobs`/`max_worker_processes` pasan a ser parte del checklist de setup de cada instalación nueva.

## Revisión — implementación real

Al implementar, `pg_cron` resultó NO estar disponible en la imagen `postgres:17-alpine` usada por este proyecto en local (`docker-compose.yml`) — la premisa de portabilidad de la ADR (managed Postgres: RDS/Aurora/Cloud SQL/Supabase) no cubre un Postgres autohosteado en Docker sin la extensión instalada. Se resolvió agregando `docker/postgres/Dockerfile`, que compila `pg_cron` desde el código fuente contra la misma imagen (evita mismatch de ABI contra el paquete apk de Alpine, que además solo existe en su repo `edge`) — con `shared_preload_libraries`/`cron.database_name`/`cron.use_background_workers` forzados vía `command:` en `docker-compose.yml` (necesarios en un volumen ya inicializado, donde el `.conf.sample` de la imagen no aplica). Ver `domain/procesos.md` para el detalle completo, incluida una restricción real de PL/pgSQL encontrada en el camino (`COMMIT` dentro de un bloque `BEGIN/EXCEPTION/END` — no permitido, hay que sacarlo afuera).

Implementado completo: las 4 tablas, `fn_cron_matches` (matching de cron sin nombres de mes/día ni la regla POSIX día-mes-OR-día-semana — no hacían falta para los horarios reales de este proyecto), el evaluador + 3 ejecutores + barrido de huérfanas registrados en `pg_cron`, y el ABM `/dashboard/procesos`. Verificado en vivo invocando las SPs directamente (sin esperar el tick de `pg_cron`): proceso de 2 pasos exitoso, proceso con paso que falla + reintento correcto, matching de cron contra 8 expresiones distintas, y barrido de huérfanas marcando error + generando reintento.
