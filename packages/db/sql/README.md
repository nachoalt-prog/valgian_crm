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
