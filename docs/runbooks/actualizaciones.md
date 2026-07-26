# Manual: cómo actualizar el core, un módulo, o un cliente

Este manual está escrito para que cualquiera, sin conocer el proyecto de antemano, pueda seguirlo al pie de la letra sin romper nada. Da por sentado lo decidido en `docs/decisions/0001-instancia-por-cliente.md` y `docs/decisions/0012-apps-por-cliente-y-modulos-opcionales.md`.

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

1. Hacer el cambio en `packages/core` (y/o `packages/db` si hay migración) en una rama.
2. Subir la versión en `packages/core/package.json` (ej. de `"1.4.1"` a `"1.4.2"`) siguiendo semver: parche para fixes, minor para funcionalidad nueva sin romper nada, major si rompe compatibilidad.
3. Para **cada** carpeta `apps/<cliente>`: editar su `package.json` y cambiar la versión de la dependencia `"@valgian/core"` al número nuevo del paso 2.
4. Correr `pnpm install` en la raíz del repo para que se actualicen los lockfiles.
5. Correr `pnpm build` (dispara `turbo build`, que compila TODAS las apps) y confirmar que compila sin errores para cada una. Si una app-cliente falla al compilar con el core nuevo, **no seguir** — arreglar antes de continuar.
6. Si hubo migración de base de datos: correr `pnpm db:migrate` contra la base de datos de **cada** cliente que se va a actualizar — nunca contra el Postgres local de desarrollo, y nunca "una vez para todos" si son bases separadas.
7. Deployar cada instancia, una por una. Si el proceso de deploy no está automatizado todavía, hacerlo manualmente instancia por instancia, verificando que cada una levantó bien antes de pasar a la siguiente.
8. Commitear los cambios (bump de versión en core + bump en cada app-cliente) con un mensaje que diga qué se actualizó y por qué.

## Checklist: actualizar un módulo SOLO para los clientes que lo tienen

Usar cuando el cambio es específico de un módulo opcional (ej. un fix en el módulo de facturación).

1. Hacer el cambio en `packages/modules/<nombre>` en una rama.
2. Subir la versión en `packages/modules/<nombre>/package.json`.
3. Identificar qué carpetas `apps/<cliente>` tienen ese módulo: revisar cuáles tienen `"@valgian/module-<nombre>"` en su `package.json`. **No tocar ninguna app que no lo tenga.**
4. Para cada una de esas apps (y solo esas): actualizar la versión de esa dependencia en su `package.json`.
5. Repetir los pasos 4 a 8 del checklist anterior (`pnpm install`, `pnpm build`, migraciones si las hay, deploy, commit) — pero solo sobre las apps identificadas en el paso 3.

## Checklist: mejora en código propio de un cliente (no es módulo, no se comparte)

Usar cuando el cambio es algo exclusivo de un cliente puntual — vive directo en su carpeta `apps/<cliente>/src/...`, no en `packages/core` ni en `packages/modules/*` (ver `docs/contracts/modulo.md`, sección "Qué NO es un módulo").

1. Hacer el cambio directo en `apps/<cliente>/src/...`, en una rama.
2. No hay versión de dependencia que bumpear en ningún otro `package.json` — este código no es una dependencia de nadie, es parte de la app misma.
3. Correr `pnpm --filter <nombre-app> build` (o `pnpm build` completo) y confirmar que compila.
4. Deployar únicamente la instancia de ese cliente. Ninguna otra instancia se toca ni se entera — ningún otro `apps/<otro-cliente>` importa ese código.
5. Commitear aclarando que es específico de ese cliente, para que a nadie se le ocurra "generalizarlo" más adelante sin pasar antes por convertirlo en módulo si otro cliente llega a necesitarlo también.

## Nota de seguridad

Nunca deployar directo desde un checkout local sin pasar antes por `pnpm build` (o el pipeline de CI si ya existe uno de deploy). Mandar código sin compilar y sin probar a la instancia real de un cliente es la forma más fácil de romper producción de alguien que confía en que el sistema funciona.
