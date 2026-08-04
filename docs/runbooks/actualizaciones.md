# Manual: cómo actualizar el core, un módulo, o un cliente

Este manual está escrito para que cualquiera, sin conocer el proyecto de antemano, pueda seguirlo al pie de la letra sin romper nada. Da por sentado lo decidido en `docs/decisions/0001-instancia-por-cliente.md`, `docs/decisions/0012-apps-por-cliente-y-modulos-opcionales.md`, `docs/decisions/0019-flujo-de-ramas-y-tags-de-version.md` y `docs/decisions/0020-migraciones-y-parches-por-modulo-y-cliente.md`.

**Nota sobre el estado actual**: hoy el repo solo tiene `apps/web` (la demo). Los pasos de este manual que dicen "para cada `apps/<cliente>`" empiezan a aplicar desde el momento en que exista al menos una carpeta de cliente real. Hasta entonces, `apps/web` se actualiza sola, sin checklist — solo se corre `pnpm install` y se prueba.

## Vocabulario mínimo

| Término | Qué es |
|---|---|
| **Core** | `packages/core` + `packages/db`. Lo tienen TODOS los clientes, siempre, sin excepción. |
| **Módulo** | Un paquete en `packages/modules/<nombre>`. Opcional — algunos clientes lo tienen, otros no. |
| **App-cliente** | Una carpeta `apps/<client-slug>`. Es el código concreto que corre para un cliente puntual: importa el core, importa los módulos que ese cliente tiene, y puede tener código propio que nadie más usa. |
| **Instancia** | El deploy real de una app-cliente: su propio servidor y su propia base de datos (ver ADR 0001). Una app-cliente puede tener una sola instancia (lo normal) corriendo en producción. |

## Entorno de desarrollo: uno solo, compartido

No hace falta un Postgres ni un checkout distinto por cliente para desarrollar. Para trabajar en el día a día:

1. Un único Postgres local, el que ya define `docker-compose.yml` en la raíz del repo (`docker compose up -d`).
2. Un único checkout del monorepo. Los fuentes compartidos — `packages/core`, `packages/db`, `packages/modules/*` — viven siempre ahí, nunca forkeados ni copiados a otro lado.
3. Si necesitás probar algo puntual de un cliente, corrés localmente esa carpeta (`pnpm --filter <nombre-app> dev`) apuntando al mismo Postgres local, con datos de prueba cargados vía `pnpm db:seed`.

La separación real por cliente (servidor propio, base de datos propia) es un tema de **producción**, no de desarrollo. En tu máquina, todos los clientes comparten un único Postgres de prueba.

## Checklist: actualizar el core para TODOS los clientes

Usar cuando el cambio es algo que todos los clientes deben recibir (ej. un fix de seguridad, una mejora en permisos).

1. Hacer el cambio en `packages/core` (y/o `packages/db` si hay migración) en una rama (`feature/<algo>`) — nunca directo en `master` (ADR 0019).
2. Mergear la rama a `master` una vez probada.
3. Subir la versión en `packages/core/package.json` (ej. de `"1.4.1"` a `"1.4.2"`) siguiendo semver: parche para fixes, minor para funcionalidad nueva sin romper nada, major si rompe compatibilidad. Commitear ese bump en `master` y taggear ese commit: `git tag core-v1.4.2` (ADR 0019 — el tag es lo que hace real la "versión pineada" de cada cliente, no hay registry que la resuelva sola).
4. Para **cada** carpeta `apps/<cliente>` que se va a actualizar: editar su `package.json` y cambiar la versión de la dependencia `"@valgian/core"` al número nuevo del paso 3.
5. Correr `pnpm install` en la raíz del repo para que se actualicen los lockfiles.
6. Correr `pnpm build` (dispara `turbo build`, que compila TODAS las apps) y confirmar que compila sin errores para cada una. Si una app-cliente falla al compilar con el core nuevo, **no seguir** — arreglar antes de continuar.
7. Si hubo migración de base de datos: correr `pnpm db:migrate` contra la base de datos de **cada** cliente que se va a actualizar (desde el tag `core-v1.4.2`, no desde el HEAD corriente de `master`) — nunca contra el Postgres local de desarrollo, y nunca "una vez para todos" si son bases separadas. Si además hay parches de datos pendientes, ver el checklist de parches más abajo.
8. Deployar cada instancia, una por una, desde el tag `core-v1.4.2`. Si el proceso de deploy no está automatizado todavía, hacerlo manualmente instancia por instancia, verificando que cada una levantó bien antes de pasar a la siguiente.
9. Commitear los cambios (bump de versión en cada app-cliente actualizada) con un mensaje que diga qué se actualizó y por qué.

## Checklist: actualizar un módulo SOLO para los clientes que lo tienen

Usar cuando el cambio es específico de un módulo opcional (ej. un fix en el módulo de facturación).

1. Hacer el cambio en `packages/modules/<nombre>` en una rama.
2. Mergear a `master` una vez probada.
3. Subir la versión en `packages/modules/<nombre>/package.json` y taggear: `git tag module-<nombre>-v0.2.0`.
4. Identificar qué carpetas `apps/<cliente>` tienen ese módulo: revisar cuáles tienen `"@valgian/module-<nombre>"` en su `package.json`. **No tocar ninguna app que no lo tenga.**
5. Para cada una de esas apps (y solo esas): actualizar la versión de esa dependencia en su `package.json`.
6. Repetir los pasos 5 a 9 del checklist anterior (`pnpm install`, `pnpm build`, migraciones/parches si las hay, deploy desde el tag, commit) — pero solo sobre las apps identificadas en el paso 4.

## Checklist: aplicar un parche de datos estándar

Usar cuando hay que CORREGIR un registro estándar ya sembrado (core o módulo) en una base que ya está en uso — no para agregar catálogo nuevo, eso lo cubre el seed normal (`ensureX`, insert-only, se puede recorrer de nuevo sin riesgo). Ver ADR 0020.

1. Escribir el parche en `packages/db/parches/000N_<descripcion>.ts` (o `packages/modules/<nombre>/parches/` si es específico de ese módulo), siguiente número correlativo.
2. Probarlo contra el Postgres local de desarrollo primero.
3. Mergear a `master`, taggear igual que un cambio de core/módulo si corresponde a esa versión.
4. Correr `pnpm db:parche` contra la base de **cada** cliente que corresponda — el script de parches solo aplica los que todavía no están en `_PARCHES_APLICADOS` de esa base, así que es seguro correrlo de nuevo si hay dudas de qué quedó pendiente.
5. Commitear el parche igual que cualquier otro cambio de código.

## Checklist: mejora en código propio de un cliente (no es módulo, no se comparte)

Usar cuando el cambio es algo exclusivo de un cliente puntual — vive directo en su carpeta `apps/<cliente>/src/...`, no en `packages/core` ni en `packages/modules/*` (ver `docs/contracts/modulo.md`, sección "Qué NO es un módulo").

1. Hacer el cambio directo en `apps/<cliente>/src/...`, en una rama.
2. No hay versión de dependencia que bumpear en ningún otro `package.json` — este código no es una dependencia de nadie, es parte de la app misma.
3. Si el cambio necesita una tabla/columna propia de ese cliente: migración en `apps/<cliente>/migrations/` (ADR 0020), aplicada solo contra su base.
4. Correr `pnpm --filter <nombre-app> build` (o `pnpm build` completo) y confirmar que compila.
5. Deployar únicamente la instancia de ese cliente. Ninguna otra instancia se toca ni se entera — ningún otro `apps/<otro-cliente>` importa ese código.
6. Commitear aclarando que es específico de ese cliente, para que a nadie se le ocurra "generalizarlo" más adelante sin pasar antes por convertirlo en módulo si otro cliente llega a necesitarlo también.

Si en cambio lo que hay que corregir es un DATO puntual de ese cliente (no código), no es este checklist — ver `docs/runbooks/soporte.md`.

## Nota de seguridad

Nunca deployar directo desde un checkout local sin pasar antes por `pnpm build` (o el pipeline de CI si ya existe uno de deploy). Mandar código sin compilar y sin probar a la instancia real de un cliente es la forma más fácil de romper producción de alguien que confía en que el sistema funciona.
