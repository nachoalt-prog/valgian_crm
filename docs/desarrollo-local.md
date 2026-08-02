# Cómo correr el proyecto en local

Guía práctica para levantar el ambiente de desarrollo. Para el "qué" y el "por qué" del stack, ver `architecture/stack.md`.

## Requisitos

- Node.js 20+
- Docker Desktop (para Postgres local)
- pnpm — ver nota abajo si no lo tenés instalado global

### Si no tenés `pnpm` instalado

`corepack enable` lo resuelve, pero en Windows puede fallar con un error de permisos (`EPERM`, intenta escribir en `Program Files`). Si pasa eso, corré esa misma línea una vez desde una terminal como Administrador — después `pnpm` anda normal en cualquier terminal.

Alternativa sin instalar nada: anteponer `npx pnpm@11.17.0` a cualquier comando de esta guía (ej. `npx pnpm@11.17.0 dev` en vez de `pnpm dev`).

## Variables de entorno

Copiar `.env.example` a `.env` en la raíz del repo (una sola vez, no se versiona):

```
DATABASE_URL=postgresql://valgian:valgian@localhost:5432/valgian_crm
```

Es la única fuente de `.env` del monorepo — `packages/db`, `packages/core` y `apps/web` lo leen todos desde la raíz, no hace falta duplicarlo.

## Primera vez (o para resetear todo desde cero)

```
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
```

`docker compose up -d` construye la imagen de Postgres la primera vez (no es la oficial de Docker Hub a secas — `docker/postgres/Dockerfile` le compila `pg_cron` encima, ver ADR 0015/`domain/procesos.md`) — tarda más que un simple `pull` esa primera corrida. Si ya tenías el contenedor levantado de ANTES de que existiera ese Dockerfile, `docker compose up -d` no lo reconstruye solo — correr `docker compose build postgres && docker compose up -d` una vez (no borra datos, mismo volumen).

El seed crea un usuario administrador: **`admin` / `admin123`** (solo para desarrollo local, no tiene ninguna sensibilidad real).

### Los seeds

El seed base está partido en tres, cada uno pensado para un momento distinto, más un cuarto seed regional que se suma solo cuando aplica:

| Seed | Comando | Qué trae | ¿Sirve para una instalación real? |
|---|---|---|---|
| Principal | `pnpm db:seed` | Lo mínimo para que el sistema funcione: usuario admin, catálogos base (géneros, país/provincias, tipo de documento, carácter Titular), menúes/herramientas/permisos del core | Sí — es obligatorio |
| Config modelo | `pnpm db:seed:config` | Configuración reusable de ejemplo para arrancar rápido: caracteres Secundario/Pariente, una estrategia de estados para legajos, y una bandeja de búsqueda ya armada y funcional | Sí — opcional, pensado como plantilla de arranque rápido |
| Demo/mock | `pnpm db:seed:demo` | Datos ficticios de prueba: 10 legajos + 20 clientes inventados | No — solo para desarrollo/pruebas |
| Demo emails/mensajería | `pnpm db:seed:demo:emails` | Datos ficticios de prueba para el circuito de placeholders → plantillas → trámites → mensajería (ver `domain/acciones-externas.md`) | No — solo para desarrollo/pruebas |
| Configuración Argentina | `pnpm db:seed:configuracion-argentina` | Catálogo `MONEDAS` (peso + tipos de dólar) — ver `domain/acciones-externas.md` | Solo para clientes en Argentina — separado de "Config modelo" a propósito, no es genérico para cualquier instalación |

`db:seed:demo` depende de `db:seed:config` (usa la estrategia/estado y los caracteres que crea), que a su vez depende de `db:seed` (usa el usuario admin y los catálogos base). `db:seed:demo:emails` depende de `db:seed:demo` (usa los legajos/clientes/`EMAILS` que ese seed crea). Correr en ese orden. `db:seed:configuracion-argentina` solo depende de `db:seed` (los catálogos base) — independiente del resto.

## Día a día

Si Postgres ya está corriendo (`docker ps` para confirmar) y ya migraste/seedeaste antes:

```
pnpm dev
```

Entrar a **http://localhost:3000**.

## Resetear la base a estado limpio

Borra todos los datos (útil después de cambios de schema, o si algo quedó en un estado raro):

```
docker compose down -v
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm db:seed:config
pnpm db:seed:demo
```

## Comandos sueltos

| Comando | Qué hace |
|---|---|
| `docker compose up -d` | Levanta Postgres en background |
| `docker compose down -v` | Para Postgres y borra el volumen (todos los datos) |
| `pnpm dev` | Levanta `apps/web` en modo desarrollo (Turbopack) |
| `pnpm db:generate` | Genera una migración nueva a partir de cambios en `packages/db/src/schema.ts` |
| `pnpm db:migrate` | Aplica las migraciones pendientes contra Postgres |
| `pnpm db:seed` | Corre el seed mínimo (`packages/core/src/seed.ts`) — es idempotente, no hace nada si el usuario admin ya existe |
| `pnpm db:seed:config` | Corre el seed de configuración modelo (`packages/core/src/seed-config.ts`) — opcional, idempotente |
| `pnpm db:seed:demo` | Corre el seed de datos ficticios de prueba (`packages/core/src/seed-demo.ts`) — opcional, idempotente, no usar en una instalación real |
| `pnpm db:seed:configuracion-argentina` | Corre el seed de `MONEDAS` para Argentina (`packages/core/src/seed-configuracion-argentina.ts`) — opcional, idempotente, solo para clientes en Argentina |
| `pnpm lint` | Corre lint/type-check en todo el workspace (tsc en los packages, eslint en apps/web) |

## Troubleshooting

- **`pnpm : El término 'pnpm' no se reconoce...`** (PowerShell): ver la nota de instalación más arriba.
- **Docker Desktop no está corriendo**: `docker compose up -d` va a fallar. Abrir Docker Desktop y esperar a que el ícono indique que el daemon está listo antes de reintentar.
- **`DATABASE_URL no está definida`**: falta el `.env` en la raíz — ver sección de variables de entorno.
- **Cambié el schema y `db:migrate` no refleja el cambio**: correr `pnpm db:generate` primero para generar la migración nueva.
- **Una ruta de API dinámica (`app/api/.../[id]/route.ts`) devuelve el 404 nativo de Next ("This page could not be found") en vez de tu propio JSON de error, aunque el archivo esté bien y la ruta estática hermana (`route.ts` sin `[id]`) responda normal**: caché de dev de Turbopack corrupto — típicamente después de matar el proceso de `next dev` de forma abrupta (`taskkill /F`, cerrar la terminal) en vez de un shutdown limpio. Sintoma del lado del cliente: una acción que hace `fetch` + `await res.json()` sin `try/catch` se queda "colgada" para siempre (el body es HTML, no JSON, `.json()` tira una excepción no atrapada y el estado `pending` nunca se resetea) — no es un bug de permisos ni de la acción en sí. Fix: parar el server, borrar `apps/web/.next`, volver a levantar con `pnpm dev`.
