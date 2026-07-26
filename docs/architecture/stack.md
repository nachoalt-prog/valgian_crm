# Stack tecnológico

Estado actual del stack. El por qué de cada elección y sus alternativas descartadas viven en las ADR enlazadas — este documento solo describe qué se usa.

| Capa | Tecnología | Detalle |
|---|---|---|
| Frontend + capa de API | Next.js 16 (App Router, Turbopack) | Sin backend separado — server actions y route handlers. Ver ADR 0004. |
| Base de datos | PostgreSQL 17 | Una instancia separada por cliente. Ver ADR 0002. |
| ORM / migraciones | Drizzle | Ver ADR 0003. |
| Monorepo | Turborepo + pnpm | Ver ADR 0005. Ver "Estructura del monorepo" más abajo. |
| Autenticación | Solución propia — Argon2id (`@node-rs/argon2`) + token en USUARIOS | No depende de un servicio externo hosteado. Ver ADR 0006 y ADR 0010. |
| UI | Tailwind CSS v4 + shadcn/ui (estilo `base-nova`, sobre `@base-ui/react`) | Ver ADR 0007. Ojo: no es la variante clásica de shadcn sobre Radix — cambia la API de composición de los componentes (`render` prop en vez de `asChild`). |
| Identificadores | UUID en todas las tablas | Ver ADR 0008. |
| Lógica de motor de estados | PL/pgSQL (Stored Procedures) | Ver ADR 0009. Todavía no implementado en schema real — ver `domain/motor-de-estados.md`. |
| Trabajos en segundo plano | BullMQ + Redis | Contemplado, no incorporado todavía — se suma cuando un módulo concreto lo requiera. |
| Lenguaje | TypeScript ^5.7 | Fijado deliberadamente por debajo de la última mayor (7.x, basada en el compilador en Go) por compatibilidad con el resto del ecosistema (drizzle-kit, eslint-config-next). Revisar cuando ese ecosistema madure soporte. |

## Modelo de distribución

Instancia separada por cliente (self-hosted o cloud independiente). Ver ADR 0001.

## Estructura del monorepo

```
apps/
  web/              — la única app Next.js (UI + server actions + route handlers)
packages/
  db/               — schema Drizzle, migraciones generadas, y sql/ para las
                      migraciones manuales del motor de estados (ADR 0009)
  core/             — lógica de dominio y de negocio (auth, permisos, ABMs) —
                      consumida por apps/web como paquete de workspace
```

Convención: `apps/web` no accede a Postgres directo salvo a través de `@valgian/core` o `@valgian/db` — la lógica de negocio (queries, validaciones, reglas) vive en `packages/core`, no en componentes ni server actions de la app. `packages/core` depende de `packages/db`, nunca al revés.

Nota técnica para cualquier paquete nuevo del workspace consumido por `apps/web`: hay que sumarlo a `transpilePackages` en `apps/web/next.config.ts` (Next no procesa por default paquetes resueltos vía symlinks de pnpm), y sus imports internos no pueden usar la extensión `.js` en imports relativos (Turbopack no la resuelve, a diferencia de `tsx`).
