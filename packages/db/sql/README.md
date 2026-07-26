# SQL manual

Acá viven las migraciones SQL manuales de la lógica que no pasa por Drizzle: los Stored Procedures del motor de estados y el código de `ACCIONES.COMANDO` (ver ADR 0009 y `domain/motor-de-estados.md`).

Se versionan por separado de `packages/db/migrations/` (que genera `drizzle-kit` automáticamente a partir de `src/schema.ts`) porque Drizzle no puede generar PL/pgSQL — son dos fuentes de migraciones independientes contra la misma base.

Se aplican a mano contra la base (no hay corredor automático todavía):

```sh
psql "$DATABASE_URL" -f sql/0001_trigger_clientes_titular.sql
```

## Archivos

- `0001_trigger_clientes_titular.sql`: trigger que garantiza que `CLIENTES.ES_TITULAR = true` sea único por `ID_LEGAJO` (ver `domain/core.md`, sección Clientes).

Los Stored Procedures del motor de estados (ADR 0009) todavía no están escritos — se suman acá cuando se implemente la ejecución de transiciones.
