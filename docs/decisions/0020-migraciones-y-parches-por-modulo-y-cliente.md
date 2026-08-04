# 0020 - Migraciones y parches por módulo y por cliente

## Estado

Aceptada

## Contexto

El contrato de módulo (`docs/contracts/modulo.md`, punto 5) ya preveía que cada módulo tuviera "su propia carpeta de migraciones Drizzle", pero nunca se formalizó dónde exactamente ni se llegó a usar — hoy ningún módulo tiene tablas propias: `cotizaciones-argentina` y `mensajeria-smtp` solo aportan código (handlers) y registros de configuración sobre tablas genéricas del core (`ACCIONES_EXTERNAS`, `PROCESOS`, `MONEDAS`). Tampoco existe el equivalente para código exclusivo de un cliente (`apps/<client-slug>`) — nunca hizo falta todavía.

Por separado: todo el mecanismo de seed (`ensureX`) es estrictamente insert-only — agrega catálogo por default si no existe, pero nunca actualiza una fila ya sembrada. Sirve para instalar, no sirve para corregir algo que ya quedó mal en una base que ya está en uso. Hasta ahora esto se resolvió con scripts sueltos de una sola corrida, descartados después de usarlos — funciona en etapa de desarrollo (sin clientes reales, sin nada que perder), pero no es un mecanismo repetible ni auditable una vez que haya instancias en producción.

## Decisión

**Nota sobre el estado actual**: la distinción estructura/configuración y el uso del `seed.ts` propio de cada módulo YA están en uso hoy — los dos módulos existentes (`cotizaciones-argentina`, `mensajeria-smtp`) ya funcionan así, esto solo lo formaliza. Lo que todavía NO existe ni hace falta usar: carpetas de migraciones por módulo/cliente (cero tablas propias hasta ahora) y el mecanismo de parches (`packages/db/parches/`, tabla `_PARCHES_APLICADOS`, `pnpm db:parche`) — no hay ninguna instancia en producción con datos que corregir todavía. Se documenta por adelantado para no tener que diseñarlo bajo presión el día que haga falta, no porque haya que construirlo ahora mismo.

### Estructuras (DDL)

- **Core**: sigue siendo `packages/db/migrations/` — el único que se aplica a TODOS los clientes, sin excepción.
- **Módulo**: cuando un módulo necesite tablas/SPs/FNs propias, viven en `packages/modules/<nombre>/migrations/` (Drizzle propio, con su propio `schema.ts` si hace falta) — aplicado únicamente contra la base de los clientes que tienen ese módulo. Vive dentro del paquete del módulo (no anidado en `packages/db/`) para que el límite de "quién recibe esto" sea físicamente obvio con solo mirar de qué carpeta viene — mismo espíritu que la regla de dependencia no negociable del contrato de módulo.
- **Cliente**: cuando un cliente necesite tablas propias, viven en `apps/<client-slug>/migrations/`, aplicado únicamente contra su propia base.

### Registros de configuración (no confundir con estructuras ni con datos de negocio de un cliente)

Los registros que un módulo necesita para funcionar (ej. la fila de `ACCIONES_EXTERNAS` para `dolarapi`, filas de `MONEDAS`) no son estructura ni son dato de negocio de un cliente — son configuración estándar de ese módulo. Siguen viviendo en el `seed.ts` propio de cada módulo (patrón `ensureX`, ya en uso hoy), separado del seed del core.

### Parches — mecanismo nuevo, para actualizar (no insertar) registros ya existentes

Dos casos, con mecanismos distintos a propósito:

1. **Parche de datos estándar** (corrige algo mal sembrado por el core o por un módulo; puede aplicar a varios clientes que están en la misma versión): `packages/db/parches/` (o `packages/modules/<nombre>/parches/` si el parche es propio de ese módulo) — scripts numerados y ordenados (`0001_<descripcion>.ts`), con una tabla de control por base (`_PARCHES_APLICADOS`) que registra cuáles ya corrieron, para que un `pnpm db:parche` solo aplique los pendientes. Mismo circuito de entrega que las migraciones — versión y tag (ADR 0019), aplicado contra la base de cada cliente que corresponda.
2. **Parche de soporte** (corrige un dato puntual de UN cliente — su propio dato de negocio, no algo estándar): no es repetible ni se versiona globalmente. Se escribe como script puntual, se corre una sola vez contra la base de ESE cliente, y **se commitea de forma permanente** (no se borra) bajo `docs/runbooks/soporte-parches/<client-slug>/<fecha>-<descripcion>.sql` — reemplaza al criterio anterior de `runbooks/soporte.md` ("documentar el ajuste en algún lugar rastreable"), dando trazabilidad real sin mezclarse con el mecanismo de parches estándar, que si se reejecutara por error contra el cliente equivocado podría corromper datos que no debía tocar.

## Alternativas consideradas

- **Un solo mecanismo de parches para ambos casos**: descartado — un parche de soporte nunca debe poder "reejecutarse" contra otro cliente por error de operación; separarlos evita ese riesgo por diseño, no dependiendo de la disciplina de quien lo corre.
- **Versionar los parches junto con las migraciones, en el mismo folder y la misma tabla de control**: descartado — son conceptualmente distintos (DDL vs. DML) y mezclarlos complica saber, mirando una carpeta, si hace falta o no una migración de estructura real antes de aplicar algo.

## Consecuencias

- Nace un tercer tipo de artefacto de base de datos, además de migraciones (estructura) y seeds (altas idempotentes): parches (correcciones sobre datos ya existentes). Cada uno con su propio mecanismo de tracking y su propio criterio de cuándo usarlo.
- `runbooks/actualizaciones.md` gana un checklist nuevo ("aplicar un parche de datos estándar").
- `runbooks/soporte.md` cambia su paso de documentación — ya no alcanza con anotarlo en un ticket, el script en sí queda commiteado como el registro permanente.
- Sigue habiendo cero casos reales de tabla propia de módulo o de cliente hoy — este ADR define el mecanismo por adelantado, no porque haga falta usarlo ahora mismo.
