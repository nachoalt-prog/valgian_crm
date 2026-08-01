# Dominio — Procesos

> **Estado: diseñado, pendiente de implementación.** Este documento describe el diseño acordado (ver ADR 0015), no código ya construido — a diferencia del resto de `domain/`, que describe el sistema tal como es hoy. Se actualiza este encabezado en cuanto se implemente.

Procesos automáticos programados (tipo Scheduler): cada `PROCESO` corre según un horario (`CRON`), se divide en `PASOS` ordenados, deja auditoría completa de cada corrida, y reintenta automáticamente ante fallo — retomando desde el paso que falló, no desde el principio. El disparo corre en `pg_cron`, no en la aplicación — ver ADR 0015 para el porqué.

## Tablas

### PROCESOS

| Campo             | Tipo                                                       |
| ------------------ | ------------------------------------------------------------ |
| ID                  | UUID, PK                                                      |
| CODIGO              | string, unique                                                |
| NOMBRE              | string                                                        |
| DESCRIPCION         | string, nullable                                              |
| CRON                | text — expresión cron completa (ej. `'0 1 * * *'`)            |
| ACTIVO              | boolean                                                       |
| REINTENTO_MINUTOS   | integer, nullable — cada cuánto reintentar tras un fallo. Null = no reintenta |
| REINTENTOS_MAX      | integer, nullable — tope de reintentos antes de darse por vencido |

`CODIGO`/`NOMBRE`/`DESCRIPCION`/`ACTIVO`/`CRON`/`REINTENTO_MINUTOS`/`REINTENTOS_MAX` se administran vía ABM — es config operativa, no lógica. Agotar `REINTENTOS_MAX` en una ejecución puntual **no desactiva** el `PROCESO`: la próxima corrida oficial programada por `CRON` arranca de cero igual, sin arrastrar el fallo anterior.

### PROCESOS_PASOS

| Campo            | Tipo                                             |
| ----------------- | --------------------------------------------------- |
| ID                 | UUID, PK                                             |
| ID_PROCESO         | FK → PROCESOS                                        |
| ORDEN              | integer                                              |
| NOMBRE             | string — identifica el paso en logs/errores          |
| COMANDO            | text — SQL de confianza, mismo modelo que `ACCIONES.COMANDO` (ADR 0009) |
| TIMEOUT_MINUTOS    | integer, nullable — máximo esperado para ESTE paso puntual, usado por el barrido de huérfanas |

**Dev-only** — igual que `ACCIONES.COMANDO`, se carga por código/migración. El ABM de `PROCESOS` **no toca** `PROCESOS_PASOS` ni su `COMANDO`.

`TIMEOUT_MINUTOS` es por paso, no un valor global del `PROCESO`: un proceso puede tener pasos que en promedio tardan 1 minuto y otros que tardan 50 — cada uno define su propia expectativa.

### PROCESOS_EJECUCIONES

Auditoría **y** cola de disparo — una fila es tanto "esto hay que correr" como "esto se corrió, así salió". Cubre corridas oficiales, reintentos, y disparos manuales por igual: son la misma cola, distinguidos solo por `ORIGEN`.

| Campo               | Tipo                                                      |
| --------------------- | ------------------------------------------------------------ |
| ID                     | UUID, PK                                                      |
| ID_PROCESO             | FK → PROCESOS                                                 |
| FECHA_PROGRAMADA       | timestamp — cuándo tiene que correr esta instancia puntual    |
| NUMERO_INTENTO         | integer, default 1                                            |
| ID_EJECUCION_ORIGEN    | FK nullable, self-reference → PROCESOS_EJECUCIONES — si es reintento, la ejecución que falló |
| ESTADO                 | `pendiente / procesando / completado / error`                 |
| FECHA_INICIO           | timestamp, nullable — arranque de TODA la ejecución            |
| FECHA_INICIO_PASO      | timestamp, nullable — arranque del paso actualmente en curso (distinto de `FECHA_INICIO`; es lo que compara el barrido de huérfanas contra `TIMEOUT_MINUTOS` del paso en curso) |
| FECHA_FIN              | timestamp, nullable                                            |
| ERROR                  | text, nullable                                                 |
| ID_ULTIMO_PASO_OK      | FK nullable → PROCESOS_PASOS — hasta dónde llegó bien           |
| ID_PASO_ERROR          | FK nullable → PROCESOS_PASOS — cuál rompió (si `ESTADO='error'` y se llegó a capturar la excepción) |
| ID_PASO_DESDE          | FK nullable → PROCESOS_PASOS — desde qué paso arranca ESTA ejecución (null = desde el primero) |
| ORIGEN                 | text: `cron` / `manual` / `reintento`                          |
| ID_USUARIO_DISPARO     | FK nullable → USUARIOS — quién lo disparó, si `ORIGEN='manual'` |

Unique en (`ID_PROCESO`, `FECHA_PROGRAMADA`) — dedup: aunque haya varios ejecutores en paralelo y el evaluador corra en distintos ticks, nunca se duplica un disparo para el mismo instante programado.

**Cómo se calcula `ID_PASO_DESDE` de un reintento:**
- Si la ejecución que falló SÍ llegó a grabar `ID_PASO_ERROR` (la excepción se capturó normal): el reintento arranca ahí mismo.
- Si NO (Postgres se cayó antes de poder grabarlo — detectado por el barrido de huérfanas): el reintento arranca en el paso siguiente a `ID_ULTIMO_PASO_OK` (o en el primero, si `ID_ULTIMO_PASO_OK` también es null).

### PROCESOS_EJECUCIONES_PASOS

Historial detallado, un registro por cada intento de cada paso dentro de una ejecución — a diferencia de `PROCESOS_EJECUCIONES` (que solo guarda el ÚLTIMO puntero de progreso), esta tabla da la línea de tiempo completa.

| Campo         | Tipo                                     |
| -------------- | ------------------------------------------- |
| ID              | UUID, PK                                     |
| ID_EJECUCION    | FK → PROCESOS_EJECUCIONES                     |
| ID_PASO         | FK → PROCESOS_PASOS                           |
| FECHA_INICIO    | timestamp                                     |
| FECHA_FIN       | timestamp, nullable                           |
| ESTADO          | `procesando / completado / error`             |
| ERROR           | text, nullable                                |

## Mecanismo

### 1 job evaluador + N jobs ejecutores (`pg_cron`)

Ver ADR 0015 para el razonamiento completo. Resumen del mecanismo:

- **Evaluador** (1 job, liviano, registrado una única vez): cada minuto, para cada `PROCESO` activo cuyo `CRON` matchea el instante actual, `INSERT ... ON CONFLICT DO NOTHING` en `PROCESOS_EJECUCIONES` (`ORIGEN='cron'`). Nunca corre `COMANDO` de negocio — nunca se bloquea.
- **Ejecutores** (N jobs idénticos, registrados una única vez cada uno): reclaman con `FOR UPDATE SKIP LOCKED` una fila `pendiente` con `FECHA_PROGRAMADA` vencida, **verificando primero que no haya ya otra ejecución `procesando` del mismo `ID_PROCESO`** (con N ejecutores en paralelo, dos filas del mismo proceso SÍ podrían reclamarse en simultáneo sin este guard — a diferencia de un único job serializado, donde sería estructuralmente imposible).
- Requiere una función PL/pgSQL que evalúe si una expresión `CRON` matchea un timestamp dado — no viene con Postgres, es pieza nueva a escribir.
- Config: `cron.use_background_workers = on` (evita que N ejecutores tickeando cada minuto consuman conexiones `libpq` regulares — ya hubo problemas de "too many clients already" en este proyecto, ver `packages/db/src/client.ts`). Dimensionar `cron.max_running_jobs`/`max_worker_processes` con margen sobre `1 + N`.

### Ejecución paso a paso

La SP ejecutora corre en una `PROCEDURE` (vía `CALL`, no una `FUNCTION` — necesita controlar sus propias transacciones):

1. Determina el punto de arranque: `ID_PASO_DESDE` de la fila, o el primer `PASO` por `ORDEN` si es null.
2. Por cada `PASO` desde ahí en adelante: corre su `COMANDO`. Si sale bien, actualiza `ID_ULTIMO_PASO_OK` + inserta/actualiza el registro correspondiente en `PROCESOS_EJECUCIONES_PASOS` + `COMMIT` — todo en la misma transacción que el `COMANDO` del paso, para que no exista un estado ambiguo si Postgres se cae a mitad de camino (o el paso completo (trabajo + progreso) quedó confirmado, o ninguna de las dos cosas pasó).
3. Antes de correr cada paso, actualiza `FECHA_INICIO_PASO` (para que el barrido de huérfanas pueda medir cuánto lleva el paso EN CURSO, no toda la ejecución).
4. Si un paso tira excepción: `ESTADO='error'`, `ID_PASO_ERROR`, `ERROR`, `FECHA_FIN`. Si `NUMERO_INTENTO < REINTENTOS_MAX`, inserta la fila de reintento (`ORIGEN='reintento'`, `FECHA_PROGRAMADA = ahora + REINTENTO_MINUTOS`, `ID_PASO_DESDE` calculado según la regla de arriba).
5. Si todos los pasos terminan bien: `ESTADO='completado'`, `FECHA_FIN`.

### Barrido de huérfanas

Filas `procesando` cuyo paso en curso superó su `TIMEOUT_MINUTOS` (comparado contra `FECHA_INICIO_PASO`, no contra `FECHA_INICIO`) se marcan `error` — sin `ID_PASO_ERROR` (no se pudo capturar la excepción real, Postgres se cayó en el medio) — y siguen la misma lógica de reintento. **Cuenta como intento fallido contra `REINTENTOS_MAX`**: un ambiente con caídas frecuentes no obtiene reintentos gratis por fuera del tope.

### Zona horaria

`cron.timezone` es config de infraestructura **por instalación** (mismo criterio que ADR 0013), no una columna de `PROCESOS` — ver ADR 0015. Toda hora que maneje una instalación de este sistema es la hora local de ESA instalación.

### Apagar el scheduler

Operación de infraestructura (`cron.unschedule()`/`cron.schedule()` sobre esa base puntual), parte del setup de cada ambiente — no un toggle en caliente desde la app. Útil para instalaciones o ambientes de test que quieran ahorrarse el overhead.

### Scheduler apagado un tiempo largo

Por diseño, **no hay catch-up automático**: el evaluador solo mira "¿matchea AHORA?", nunca reconstruye lo que se hubiera disparado durante el tiempo apagado. Si un `PROCESO` puntual necesita contemplar "no corrí en X tiempo, hay que hacer algo especial", esa lógica vive en sus propios `PASOS` — no es responsabilidad del motor genérico.

### Disparo manual

Desde el ABM de `PROCESOS`, un botón "Correr ahora" — no necesita mecanismo aparte: es un `INSERT` directo en `PROCESOS_EJECUCIONES` (`ORIGEN='manual'`, `ID_USUARIO_DISPARO`, `FECHA_PROGRAMADA=ahora`, sin `ID_PASO_DESDE`), sin pasar por el evaluador. Se suma a la misma cola que ya reclaman los ejecutores — mismo guard de no-solapamiento, mismas reglas de reintento si falla.

## Cómo se conecta con acciones externas

Un `PASO` cuyo `COMANDO` necesita algo que Postgres no puede hacer solo (mandar un mail, pegarle a un webhook, a futuro exportar/importar un archivo) simplemente hace `INSERT` en `ACCIONES_EXTERNAS_COLA` (mismo patrón de cola + `pg_notify` que `GENERACIONES_DOCUMENTO`, ver `domain/generacion-documentos.md`) y sigue de largo — el `INSERT` es instantáneo, el paso no espera respuesta. El worker de Node (extiende `instrumentation-node.ts`) procesa esa cola de forma completamente desacoplada del scheduler de Procesos.

`ACCIONES_EXTERNAS` (catálogo) y `ACCIONES_EXTERNAS_COLA` (cola) están documentadas en detalle en `domain/acciones-externas.md` (ver ADR 0016) — candidatos naturales para sumar `'exportacion'`/`'importacion'` como `COMPONENTE` el día que existan esos módulos, sin tocar `PROCESOS`.

## ABM

- **`/dashboard/procesos`** (`HERRAMIENTAS.CODIGO = 'procesos'`): listado de `PROCESOS`, edición de `CODIGO`/`NOMBRE`/`DESCRIPCION`/`ACTIVO`/`CRON`/`REINTENTO_MINUTOS`/`REINTENTOS_MAX`, botón "Correr ahora" por proceso. **No edita `PROCESOS_PASOS`** — eso es dev-only.

## Pendiente de implementación

- Migración Drizzle de las 4 tablas (`PROCESOS`, `PROCESOS_PASOS`, `PROCESOS_EJECUCIONES`, `PROCESOS_EJECUCIONES_PASOS`).
- Función PL/pgSQL de matching de expresiones cron.
- SP evaluadora + SP(s) ejecutora(s), registro de 1 job evaluador + N jobs ejecutores en `pg_cron`, con `cron.use_background_workers = on`.
- Barrido de huérfanas (timeout por paso).
- Herramienta `/dashboard/procesos`.
- A futuro: `REPORTE` de auditoría sobre `PROCESOS_EJECUCIONES` (reusando el módulo de Reportes, ver `domain/reportes.md`).

`ACCIONES_EXTERNAS`/`ACCIONES_EXTERNAS_COLA` ya están implementadas (ver `domain/acciones-externas.md` / ADR 0016) — Procesos las va a usar tal cual apenas exista, sin tocarlas.

Ver ADR 0015 para el razonamiento completo de las decisiones de diseño.
