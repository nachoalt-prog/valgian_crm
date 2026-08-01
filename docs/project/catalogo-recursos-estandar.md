# Catálogo de recursos estándar

Documento vivo — se edita in-place, crece cada vez que se construye un recurso estándar nuevo. Ver ADR 0017 para qué es un Recurso, la diferencia entre estándar y custom, y por qué es un concepto distinto de "Módulo" (ADR 0012).

**Acá solo van recursos ESTÁNDAR** (pensados para reusarse en más de una instalación). Un recurso CUSTOM — hecho a medida para un cliente puntual, sin vocación de reuso — no se cataloga acá: se documenta directo en el formulario de instalación de ese cliente (`docs/runbooks/formulario-instalacion.md`, sección de Recursos).

Se usa en dos momentos: al completar `docs/runbooks/formulario-instalacion.md` para un cliente nuevo (elegir cuáles recursos estándar aplican), y al ejecutar `docs/runbooks/nueva-instalacion.md` (correr el seed de cada uno elegido, respetando dependencias).

## Cómo leer la tabla

| Columna | Qué significa |
|---|---|
| **Recurso** | Nombre descriptivo, el que va a ver quien completa el formulario |
| **Motor** | En qué motor genérico del core vive (Bandejas, Reportes, Procesos, Acciones Externas, Tipos de Trámite, Wizards a futuro) |
| **Seed** | Qué comando/archivo lo instala |
| **Depende de** | Otros recursos estándar que tienen que estar instalados antes (por nombre de esta misma tabla). `—` si no depende de ninguno |
| **Descripción** | Una línea: para qué sirve, a quién le puede interesar |

## Bandejas

| Recurso | Seed | Depende de | Descripción |
|---|---|---|---|
| _(ninguno separado todavía — ver nota abajo)_ | | | |

## Reportes

| Recurso | Seed | Depende de | Descripción |
|---|---|---|---|
| _(ninguno separado todavía — ver nota abajo)_ | | | |

## Procesos

| Recurso | Seed | Depende de | Descripción |
|---|---|---|---|
| _(ninguno todavía — Procesos recién está diseñado, ver `domain/procesos.md`)_ | | | |

## Acciones Externas

| Recurso | Seed | Depende de | Descripción |
|---|---|---|---|
| Cotizaciones (Argentina) | `pnpm db:seed:configuracion-argentina` | — | Catálogo `MONEDAS` (peso + tipos de dólar: oficial/blue/bolsa/CCL/mayorista). Solo tiene sentido si además está instalado el módulo `@valgian/module-cotizaciones-argentina` (que trae su propio seed — la fila de `ACCIONES_EXTERNAS` que dispara la consulta contra DolarApi; ver "Módulos contratados" en el formulario) — sin el módulo, `MONEDAS` queda cargado pero sin nadie que lo consulte. Exclusivo de clientes en Argentina, ver `domain/acciones-externas.md`. |

## Tipos de Trámite

| Recurso | Seed | Depende de | Descripción |
|---|---|---|---|
| _(ninguno separado todavía — ver nota abajo)_ | | | |

## Wizards

_(motor todavía no existe — placeholder para cuando se construya)_

## Nota sobre el estado actual

Hoy `seed-config.ts` y `seed-demo.ts` (ver `desarrollo-local.md`) agrupan varias configuraciones de ejemplo juntas en un solo archivo cada uno — no están separadas en recursos individuales todavía, así que no aparecen listadas arriba con seed propio. Separarlas es trabajo pendiente (ADR 0017), a hacer de a poco a medida que haga falta instalar selectivamente lo que hoy viene todo junto. Hasta que eso pase, una instalación nueva que necesite algo de lo que hay en esos seeds los corre completos (ver `runbooks/nueva-instalacion.md`), no selectivamente.

## Cómo agregar un recurso estándar nuevo a este catálogo

Al construir un recurso estándar nuevo (un seed que instala una configuración puntual y opcional dentro de un motor del core, pensada para reusarse en más de un cliente):

1. Sumar una fila en la tabla del motor que corresponda.
2. Si depende de otro recurso estándar ya existente, declararlo en "Depende de" — el paso a paso de instalación necesita ese orden para no fallar.
3. Si es el primer recurso de un motor que todavía no tenía ninguno, reemplazar el placeholder de esa sección.

Si en cambio es algo hecho a medida para un solo cliente (recurso custom), NO va acá — se anota directo en el formulario de instalación de ese cliente.
