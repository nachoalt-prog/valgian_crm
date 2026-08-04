# 0019 - Flujo de ramas y materialización de versiones pineadas por cliente

## Estado

Aceptada

## Contexto

ADR 0012 decidió que cada `apps/<client-slug>` fija una versión exacta (nunca `workspace:*`) de `@valgian/core` y de cada `@valgian/module-*` que usa, para poder actualizar clientes de forma independiente. Pero `packages/core` y `packages/modules/*` son paquetes `private: true`, nunca publicados a ningún registry — con pnpm, un número de versión fijo en un `package.json` no tiene de dónde resolverse si no existe un paquete publicado con ese número. ADR 0012 dejó decidido el QUÉ ("versión exacta pineada") pero no el CÓMO se materializa eso en un monorepo sin registry.

Además, hoy (etapa demo, sin clientes reales) se trabaja commiteando directo a `master` — funciona mientras no haya nada que no se pueda romper, pero deja de ser viable en cuanto: (a) exista una instancia de cliente en producción que no debe verse afectada por trabajo en curso sobre `packages/core`, o (b) haya que generar la carpeta de un cliente nuevo mientras hay cambios de core a medio terminar y rotos.

## Decisión

**Nota sobre el estado actual**: hoy no hay ninguna instancia en producción que proteger (cero `apps/<client-slug>`, solo `apps/web` como demo) — está bien seguir commiteando directo a `master` como se hizo hasta ahora, no hace falta ponerse estricto con ramas para cada cambio chico. Lo que sigue pasa a ser una regla operativa obligatoria recién cuando exista al menos un cliente real (o antes, si se prefiere empezar a practicar el flujo). Hasta entonces, es la norma escrita para cuando haga falta, no una obligación de hoy.

- Todo cambio no trivial en `packages/core`, `packages/db` o `packages/modules/*` se desarrolla en una rama (`feature/<algo>`), nunca directo en `master`. `master` se mantiene siempre en un estado sano/deployable.
- Al terminar y probar una rama, se mergea a `master` (`git merge`) — no hace falta rama propia por cliente, ver "Alternativas consideradas".
- Cada vez que se sube la versión de `packages/core/package.json` (o de un módulo) siguiendo semver, se taggea ese commit de `master`: `git tag core-vX.Y.Z` (o `module-<nombre>-vX.Y.Z`). **El tag es lo que le da significado real al número de versión** escrito en el `package.json` de cada cliente — no hay resolución automática vía registry, el tag es el mecanismo.
- El deploy de una instancia de cliente se buildea siempre desde el commit/tag que corresponde a la versión declarada en su propio `package.json` — nunca desde el HEAD corriente de `master`. Actualizar un cliente es una acción explícita: bump de versión en su `package.json` + rebuild desde el tag nuevo + redeploy de esa instancia sola (ver `runbooks/actualizaciones.md`, que incorpora este paso de tag en sus checklists).
- Generar la carpeta de un cliente nuevo (`apps/<client-slug>`, Fase 0 de `runbooks/nueva-instalacion.md`) siempre parte del último estado estable de `master` (el último tag relevante), nunca de una rama de feature en curso.

## Alternativas consideradas

- **Una rama larga por cliente** (`client/<nombre>`, sincronizada por merges periódicos desde `master`): descartada. Con carpetas separadas (`apps/<client-slug>`, ya decidido en ADR 0012) + tags sobre `master` alcanza para el mismo aislamiento, sin la carga de mantener N ramas vivas divergiendo, necesitando rebase/merge constante.
- **Registry privado (ej. Verdaccio) publicando `@valgian/core`/módulos de verdad**: descartada por ahora — resuelve el mismo problema de forma más "correcta" a nivel tooling (pnpm resolvería versiones de verdad, no por convención de tags), pero es una pieza de infraestructura adicional que no se justifica todavía con cero clientes reales. Reconsiderar si el número de clientes/módulos crece lo suficiente como para que el manejo manual de tags se vuelva incómodo.

## Consecuencias

- Trabajo de core que puede tardar/romper cosas ya no bloquea la posibilidad de atender a un cliente nuevo o de actualizar uno existente — quedan desacoplados por diseño (ramas separadas de `master`).
- El checklist de `runbooks/actualizaciones.md` gana un paso explícito de tag al subir versión (antes solo decía "subir la versión en `package.json`").
- Sigue sin definir la infraestructura de despliegue concreta (dónde vive cada instancia) — ver `docs/open-issues.md`, sección "Infraestructura de despliegue". Este ADR resuelve el CÓMO se versiona y se decide qué código corresponde a cada cliente; no resuelve DÓNDE corre cada uno.
