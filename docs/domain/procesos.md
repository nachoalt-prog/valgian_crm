# Dominio — Procesos

> **Estado: implementado.** Ver ADR 0015 para el razonamiento de diseño completo — este documento ya describe el sistema tal como es hoy, no un plan.

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
| ESTADO                 | `pendiente / procesando / completado / error / cancelada`     |
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

`cron.timezone` es config de infraestructura **por instalación** (mismo criterio que ADR 0013), no una columna de `PROCESOS` — ver ADR 0015. Toda hora que maneje una instalación de este sistema es la hora local de ESA instalación. En `docker-compose.yml` se fuerza `timezone`/`cron.timezone` a `America/Argentina/Buenos_Aires` vía `command:` — sin esto, Postgres arranca en UTC por default, y un `PROCESOS.CRON` tipo `0 3 * * *` (pensado como "3am hora Argentina") corre en realidad a las 3am UTC = medianoche Argentina. Bug real encontrado en vivo (no solo de display: `fn_cron_matches` usa `EXTRACT(HOUR FROM ...)`, que depende de la zona horaria de sesión) — instalaciones en otro país necesitan su propio `America/...` acá.

### Apagar el scheduler

Operación de infraestructura (`cron.unschedule()`/`cron.schedule()` sobre esa base puntual), parte del setup de cada ambiente — no un toggle en caliente desde la app. Útil para instalaciones o ambientes de test que quieran ahorrarse el overhead.

### Scheduler apagado un tiempo largo

Por diseño, **no hay catch-up automático**: el evaluador solo mira "¿matchea AHORA?", nunca reconstruye lo que se hubiera disparado durante el tiempo apagado. Si un `PROCESO` puntual necesita contemplar "no corrí en X tiempo, hay que hacer algo especial", esa lógica vive en sus propios `PASOS` — no es responsabilidad del motor genérico.

### Disparo manual

Desde el ABM de `PROCESOS`, un botón "Correr ahora" — no necesita mecanismo aparte: es un `INSERT` directo en `PROCESOS_EJECUCIONES` (`ORIGEN='manual'`, `ID_USUARIO_DISPARO`, `FECHA_PROGRAMADA=ahora`, sin `ID_PASO_DESDE`), sin pasar por el evaluador. Se suma a la misma cola que ya reclaman los ejecutores — mismo guard de no-solapamiento, mismas reglas de reintento si falla.

### Cancelación (cooperativa, no un `kill` real)

`cancelarEjecucionProceso` (`packages/core/src/procesos.ts`) marca `ESTADO='cancelada'` sobre cualquier `PROCESOS_EJECUCIONES` `pendiente`/`procesando` de ese `PROCESO`. No hay forma de interrumpir un `EXECUTE` ya en curso sin matar el backend de Postgres que lo corre — en cambio, `sp_ejecutar_un_proceso_pendiente` relee el `ESTADO` de la fila **antes de cada paso** (nunca en medio de uno) y corta el loop si ya no es `procesando`. Efecto práctico: el paso que ya estaba corriendo en el instante de la cancelación termina igual, pero ningún paso siguiente arranca, y no se genera fila de reintento. Si la ejecución todavía estaba `pendiente` (nunca la reclamó ningún ejecutor), la cancelación es inmediata y total — el claim del ejecutor filtra por `ESTADO = 'pendiente'`, así que una fila `cancelada` nunca se reclama.

ABM (`ProcesosTool`, `apps/web/src/components/procesos-tool.tsx`): mientras el `PROCESO` tiene una ejecución `pendiente`/`procesando` (`ProcesoConEstado.ejecutandose`, calculado en `listProcesosAdmin`), el botón "Correr ahora" se reemplaza por un spinner; al pasar el mouse por encima se convierte en un cuadrado rojo (tooltip "Cancelar ejecución") que dispara la cancelación al hacer click. Mientras haya algún proceso `ejecutandose`, la pantalla se refresca sola cada 3 segundos (`router.refresh()`) para que el spinner desaparezca solo apenas termine, sin depender de que el usuario haga algo.

## Cómo se conecta con acciones externas

Un `PASO` cuyo `COMANDO` necesita algo que Postgres no puede hacer solo (mandar un mail, pegarle a un webhook, a futuro exportar/importar un archivo) simplemente hace `INSERT` en `ACCIONES_EXTERNAS_COLA` (mismo patrón de cola + `pg_notify` que `GENERACIONES_DOCUMENTO`, ver `domain/generacion-documentos.md`) y sigue de largo — el `INSERT` es instantáneo, el paso no espera respuesta. El worker de Node (extiende `instrumentation-node.ts`) procesa esa cola de forma completamente desacoplada del scheduler de Procesos.

`ACCIONES_EXTERNAS` (catálogo) y `ACCIONES_EXTERNAS_COLA` (cola) están documentadas en detalle en `domain/acciones-externas.md` (ver ADR 0016) — candidatos naturales para sumar `'exportacion'`/`'importacion'` como `COMPONENTE` el día que existan esos módulos, sin tocar `PROCESOS`.

## ABM

- **`/dashboard/procesos`** (`HERRAMIENTAS.CODIGO = 'procesos'`, `packages/core/src/procesos.ts`): listado de `PROCESOS`, alta/edición de `CODIGO`/`NOMBRE`/`DESCRIPCION`/`ACTIVO`/`CRON`/`REINTENTO_MINUTOS`/`REINTENTOS_MAX`, botón "Correr ahora" por proceso (`dispararProcesoManual` — `INSERT` directo en `PROCESOS_EJECUCIONES` con `ORIGEN='manual'`). **No edita `PROCESOS_PASOS`** — eso es dev-only, se carga por seed/migración (`ensureProceso`/`ensureProcesoPaso` en `packages/core/src/seed-config.ts`). Borrado bloqueado si el proceso tiene `PROCESOS_EJECUCIONES` (audit trail). El diálogo de edición muestra los `PROCESOS_PASOS` del proceso en una lista **de solo lectura** (`listPasosPorProceso`) — nombre y timeout de cada paso, sin ningún control de edición — informativo nomás, para no tener que ir a la base a ver qué hace el proceso.

### CRON amigable — el usuario nunca edita la expresión cruda

`PROCESOS.CRON` sigue siendo una expresión cron de 5 campos en la base (sin cambios de schema), pero ni el listado ni el diálogo de edición la muestran/editan como texto libre. `apps/web/src/lib/cron-friendly.ts` traduce entre la expresión cruda y 5 presets ("Cada N minutos", "Cada N horas", "Diario", "Semanal", "Mensual" — los únicos patrones que esta instalación necesita hoy, y los únicos que ofrece el constructor). Vive en `apps/web`, **no** en `packages/core` — es la primera vez que un componente `"use client"` de este proyecto necesita un VALOR en tiempo de ejecución (no solo un tipo) de este dominio, y hacerlo pasar por el barrel de `@valgian/core` arrastra al bundle del navegador todo lo que ese barrel re-exporta (Playwright, argon2 nativo — mismo problema que ya documenta `instrumentation-node.ts` para el runtime edge, acá aplicado al bundle de cliente):

- `cronATexto(cron)`: a una oración en español, usada en el listado (`ProcesosTool`) — si el valor guardado no matchea ninguno de los 5 presets (ej. alguien lo cargó a mano por SQL antes de este mecanismo), muestra el cron crudo como fallback, nunca rompe.
- `friendlyDesdeCron(cron)`: a la forma estructurada, para precargar el diálogo de edición (`ProcesoDialog`) — `null` si no reconoce el patrón, en cuyo caso el diálogo avisa y arranca en un preset por defecto (nunca expone un campo de texto libre para el cron).
- `cronDesdeFriendly(f)`: arma la expresión cruda a partir de lo elegido en el `Select` de "Frecuencia" + los campos condicionales (N, HH:MM, día de semana/mes), para guardar.

Los 5 presets nunca generan nombres de mes/día (`MON`/`JAN`) porque el motor de matching (`packages/db/sql/0011_fn_cron_matches.sql`) no los soporta — comentario explícito ahí: "NO soporta nombres de mes/día".

## Reporte "Procesos"

Reusa el motor de Reportes (ADR 0014) tal cual — categoría `auditoria`, seedeado en `packages/core/src/seed-config.ts` junto al resto de los reportes de esa categoría (`procesos_ejecuciones`). Columnas: Proceso, Estado (`badge`, valor crudo — sin traducir a español, mismo criterio que el resto de los reportes de auditoría, para que coincida con el vocabulario del filtro de Estado), Origen, Intento, Error, Programada/Inicio/Fin (`fecha_hora`) y una última columna "Pasos" (`tipo:"pasos"`) que abre un diálogo de solo lectura (`ProcesosEjecucionPasosDialog`) con el detalle de `PROCESOS_EJECUCIONES_PASOS` de esa ejecución puntual — mismo patrón de botón-que-abre-detalle que el `tipo:"adjuntos"` del reporte de Mensajería (`domain/acciones-externas.md`). Filtros: Proceso (`select`), Estado (`select`, opciones crudas de `PROCESOS_EJECUCIONES.ESTADO`) y Fecha de Ejecución (`fecha_rango` sobre `FECHA_PROGRAMADA`).

`listPasosDeEjecucion` (`packages/core/src/procesos.ts`) es la función de solo lectura que trae ese detalle — no reusa `listPasosPorProceso` (que lista los `PROCESOS_PASOS` configurados de un `PROCESO`, no la ejecución de uno).

## Dónde vive cada pieza

- Schema: `packages/db/src/schema.ts` (`procesos`, `procesosPasos`, `procesosEjecuciones`, `procesosEjecucionesPasos`).
- SQL manual (ver `packages/db/sql/README.md`): `0011_fn_cron_matches.sql` (matching de cron), `0012_sp_evaluar_procesos.sql`, `0013_sp_ejecutar_un_proceso_pendiente.sql`, `0014_sp_barrer_procesos_huerfanos.sql`, `0015_pg_cron_jobs_procesos.sql` (registro de los jobs), `0016_sp_encolar_mensaje_sin_commit.sql` (ver `domain/acciones-externas.md` — lo usan los `PASOS` que necesitan encolar un mensaje).
- `pg_cron` no viene con la imagen oficial `postgres:17-alpine` — se compila desde el código fuente en `docker/postgres/Dockerfile` (ver nota abajo). Cualquier instalación nueva de este repo necesita esa imagen, no la oficial de Docker Hub a secas.
- ABM: `packages/core/src/procesos.ts`, `apps/web/src/app/dashboard/procesos/`, `apps/web/src/components/procesos-tool.tsx` / `proceso-dialog.tsx`.
- Procesos de ejemplo, genéricos y útiles para cualquier instalación (no son datos de demo ficticios):
  - `limpieza_tokens_vencidos` (`packages/core/src/seed-config.ts`, `0 3 * * *`): limpia `USUARIOS.TOKEN`/`TOKEN_EXPIRACION` vencidos — housekeeping, no hace falta para que el login funcione, `getSessionUser` ya filtra por vencimiento.
  - `envio_mensajes_pendientes` (`packages/core/src/seed-config.ts`, `*/5 * * * *`): ver `domain/acciones-externas.md`, sección "Disparar acciones externas / mensajes desde SQL de confianza sin COMMIT".
  - `consultar_cotizacion_dolarapi` (seed propio del módulo, `packages/modules/cotizaciones-argentina/src/seed.ts`, `0 * * * *`): encola un disparo de `consulta_cotizacion_ar` cada hora — solo existe si el módulo `cotizaciones-argentina` está instalado (mismo criterio que la fila `ACCIONES_EXTERNAS` que ese módulo ya sembraba).

### `pg_cron` en Docker — compilado desde el código fuente

`postgres:17-alpine` no trae `pg_cron`, y el paquete `postgresql-pg_cron` de Alpine solo existe en el repositorio `edge` — instalarlo así arriesga un mismatch de ABI contra los binarios de Postgres que trae la imagen oficial (no es el mismo build). `docker/postgres/Dockerfile` compila `pg_cron` desde su repo (`citusdata/pg_cron`) contra el `pg_config` de esa MISMA imagen, evitando el problema. Un detalle no obvio: por default el build de `pg_cron` intenta generar bitcode JIT (requiere `clang`/`llvm` en la versión EXACTA con la que se compiló Postgres — algo irrelevant para una extensión que no ejecuta queries) — se desactiva a mano (`with_llvm = no` en `Makefile.global`) en vez de perseguir esa compatibilidad, frágil de sostener contra los paquetes que Alpine va rotando.

`shared_preload_libraries`/`cron.database_name`/`cron.use_background_workers` se fuerzan vía `command:` en `docker-compose.yml` (no alcanza con el `.conf.sample` de la imagen: solo aplica en un `initdb` fresco, no en un volumen ya inicializado). Necesita reiniciar el contenedor de Postgres para tomar efecto — no borra datos, mismo volumen.

### Gotcha real de PL/pgSQL: `COMMIT` dentro de `BEGIN ... EXCEPTION ... END`

`sp_ejecutar_un_proceso_pendiente` necesita comitear cada paso por separado (ver "Ejecución paso a paso" arriba) Y capturar la excepción si el paso falla — la primera versión puso el `COMMIT` DENTRO del bloque `BEGIN ... EXCEPTION WHEN OTHERS ... END` que envuelve cada paso, y rompía con `cannot commit while a subtransaction is active` — **incluso en el caso sin ningún error**. Motivo: en PL/pgSQL, un bloque `BEGIN ... EXCEPTION ... END` crea una subtransacción implícita (un savepoint) durante toda su ejecución, y Postgres no permite comitear la transacción de nivel superior mientras esa subtransacción sigue activa. Se corrige sacando el `COMMIT` FUERA del bloque (después del `END;`, todavía dentro del loop) — el bloque `BEGIN/EXCEPTION/END` solo hace el trabajo + decide si hubo error, nunca controla la transacción él mismo.

Ver ADR 0015 para el razonamiento completo de las decisiones de diseño.
