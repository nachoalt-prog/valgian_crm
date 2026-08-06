# SQL manual

Acá viven las migraciones SQL manuales de la lógica que no pasa por Drizzle: los Stored Procedures del motor de estados y el código de `ACCIONES.COMANDO` (ver ADR 0009 y `domain/motor-de-estados.md`).

Se versionan por separado de `packages/db/migrations/` (que genera `drizzle-kit` automáticamente a partir de `src/schema.ts`) porque Drizzle no puede generar PL/pgSQL — son dos fuentes de migraciones independientes contra la misma base.

Se aplican a mano contra la base (no hay corredor automático todavía):

```sh
psql "$DATABASE_URL" -f sql/0001_trigger_clientes_titular.sql
```

## Archivos

- `0001_trigger_clientes_titular.sql`: trigger que garantiza que `CLIENTES.ES_TITULAR = true` sea único por `ID_LEGAJO` (ver `domain/core.md`, sección Clientes).
- `0002_sp_aplicar_estimulo.sql`: `PROCEDURE` que aplica un estímulo del motor de estados (ver `domain/motor-de-estados.md`).
- `0003_sp_gestionar_tramite.sql`: `PROCEDURE` equivalente para trámites (ver `domain/tramites.md`).
- `0004_trigger_notify_generacion_documento.sql`: `NOTIFY` para el worker de generación de documentos (ver `domain/generacion-documentos.md`).
- `0005_trigger_cascade_archivos_adjuntos_entidades.sql`: borra en cascada las filas de `ARCHIVOS_ADJUNTOS_ENTIDADES` al borrar el adjunto dueño.
- `0006_trigger_historial_vincular_adjuntos.sql`: auto-vincula a un movimiento de `HISTORIAL` los adjuntos recién subidos al mismo legajo/trámite (ver `domain/motor-de-estados.md`, sección "Adjuntos ↔ Historial").
- `0007_trigger_notify_acciones_externas_cola.sql`: `NOTIFY` para el worker de Acciones Externas (ver `domain/acciones-externas.md`).
- `0008_sp_mensajeria_encolar.sql`: `PROCEDURE` que encola un mensaje (mail/SMS/WhatsApp/...) + sus adjuntos, y opcionalmente dispara la cola genérica de Acciones Externas (ver `domain/acciones-externas.md`, sección Mensajería).
- `0009_sp_mensajeria_encolar_destino.sql`: agrega el parámetro `p_destino` a `sp_mensajeria_encolar` (`DROP` + recreate, `CREATE OR REPLACE` no alcanza cuando cambia la firma).
- `0010_trigger_emails_principal.sql`: trigger que garantiza que `EMAILS.PRINCIPAL = true` sea único por `ID_CLIENTE` (mismo criterio que `0001_trigger_clientes_titular.sql`).
- `0011_fn_cron_matches.sql`: funciones que evalúan si una expresión cron matchea un timestamp — motor de Procesos (ver `domain/procesos.md`).
- `0012_sp_evaluar_procesos.sql`: `PROCEDURE` del job evaluador de `pg_cron` (encola `PROCESOS_EJECUCIONES` pendientes).
- `0013_sp_ejecutar_un_proceso_pendiente.sql`: `PROCEDURE` de los N jobs ejecutores de `pg_cron` (reclama y corre una ejecución pendiente, paso a paso).
- `0014_sp_barrer_procesos_huerfanos.sql`: `PROCEDURE` del barrido de ejecuciones `procesando` cuyo paso en curso superó su timeout (caída de Postgres a mitad de camino).
- `0015_pg_cron_jobs_procesos.sql`: registro de los jobs de `pg_cron` (1 evaluador + 3 ejecutores + 1 barrido de huérfanas) — a diferencia de los anteriores, esto es config/infraestructura (`cron.schedule` con nombre, idempotente), no DDL.
- `0016_sp_encolar_mensaje_sin_commit.sql`: `PROCEDURE` que encola un mensaje igual que `sp_mensajeria_encolar`, sin los `COMMIT` internos — para usar desde `ACCIONES.COMANDO`/`PROCESOS_PASOS.COMANDO` (que corren vía `EXECUTE` dinámico, nunca admiten control transaccional en la cadena).
- `0017_sp_mensajeria_encolar_placeholders_forzar_inmediato.sql`: agrega `p_placeholders`/`p_forzar_inmediato` a `sp_mensajeria_encolar` (`DROP` + recreate) — ver `domain/acciones-externas.md`, sección "Probar una plantilla".
- `0018_sp_encolar_mensaje_sin_commit_placeholders_forzar_inmediato.sql`: mismos parámetros nuevos, en paridad, sobre `sp_encolar_mensaje_sin_commit`.
- `0019_trigger_tramites_numero.sql`: trigger que genera `TRAMITES.NUMERO` automáticamente al crear un trámite (ver `domain/tramites.md`).
- `0020_fn_es_dia_habil.sql`: función genérica "es día hábil" (ni fin de semana ni `FERIADOS`) — nació para el motor de Cuenta Corriente pero no es exclusiva de ningún módulo (ver `domain/core.md`, `domain/cuenta-corriente.md`).
- `0021_trigger_historial_vincular_adjuntos_cuentas.sql`: amplía `fn_vincular_adjuntos_recientes_a_historial` (`0006_...`) para que también corra sobre movimientos de `'cuentas'`, no solo `'legajos'`/`'tramites'` (`CREATE OR REPLACE`, misma firma) — ver `domain/motor-de-estados.md`, sección "Adjuntos ↔ Historial".
