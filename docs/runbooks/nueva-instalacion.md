# Manual: instalación nueva para un cliente

Paso a paso para levantar la instancia completa de un cliente nuevo, desde cero. Escrito para que cualquiera, sin conocer el proyecto de antemano, pueda seguirlo — cada paso referencia el documento que explica el "por qué" cuando hace falta, pero no hace falta leerlos todos antes de empezar.

**Antes de arrancar**: completar `docs/runbooks/formulario-instalacion.md` para este cliente. Este manual asume que ese formulario ya está lleno — varios pasos dicen literalmente "usar el valor del formulario".

Este manual es la versión manual, paso a paso. Alternativa: pasarle el formulario completado a Claude Code y que ejecute esta misma secuencia — ver la introducción de `formulario-instalacion.md`.

## Fase 0 — Código del cliente

1. Crear `apps/<client-slug>` a partir de la plantilla `apps/web` (`client-slug` = el del formulario). Hoy es un paso manual, no hay script — ver ADR 0012.
2. En `apps/<client-slug>/package.json`, fijar la versión exacta de `@valgian/core` (nunca `workspace:*` — ADR 0012) y de cada `@valgian/module-*` que este cliente tenga contratado, si hay alguno.

## Fase 1 — Infraestructura de base de datos

3. Crear la base de datos Postgres de esta instancia — propia, nunca compartida con otro cliente (ADR 0001). Self-hosted o cloud según lo definido en el formulario.
4. Configurar la zona horaria de la instalación (`TimeZone` de la base, y `cron.timezone` si se habilita `pg_cron` en el paso siguiente) con el valor del formulario — nunca asumir Argentina por default. Ver ADR 0015.
5. Si este cliente usa **Procesos** (confirmar en el formulario): habilitar la extensión `pg_cron`. El mecanismo exacto varía según el hosting:
   - Managed (RDS/Aurora, Azure Database for PostgreSQL, Google Cloud SQL): agregar `pg_cron` a `shared_preload_libraries` vía el parameter group / configuración del proveedor, reiniciar la instancia, después `CREATE EXTENSION pg_cron;`.
   - VPS propio: agregar `pg_cron` a `shared_preload_libraries` en `postgresql.conf`, reiniciar Postgres, después `CREATE EXTENSION pg_cron;`.
   - En ambos casos, configurar `cron.use_background_workers = on` (evita que los jobs consuman conexiones `libpq` regulares — ver ADR 0015).
6. Si usa Procesos: dimensionar `cron.max_running_jobs` y `max_worker_processes` con margen sobre `1 + N` (1 job evaluador + N jobs ejecutores, el número de ejecutores está en el formulario).

## Fase 2 — Variables de entorno

7. Completar el `.env` de `apps/<client-slug>` con los valores del formulario:
   - `DATABASE_URL`
   - `UPLOADS_DIR` / `MODALIDAD_ALMACENAMIENTO_ADJUNTOS` (ADR 0011, ADR 0013 — hoy solo `"filesystem"` está implementado)
   - Si usa Acciones Externas de tipo email (sprint posterior, todavía no implementado): `MODALIDAD_ENVIO_EMAIL=smtp` + host/puerto/usuario/contraseña SMTP + remitente default (ADR 0016). El componente `consulta_cotizacion` (Argentina) no necesita ninguna variable acá — DolarApi no requiere autenticación.

## Fase 3 — Dependencias del sistema

8. Si este cliente usa Generación de Documentos (confirmar en el formulario): instalar el binario de Chromium para Playwright — `npx playwright install chromium` en el servidor donde va a correr esta instancia. Ver `domain/generacion-documentos.md`.

## Fase 4 — Migraciones y seeds del core

9. `pnpm db:migrate` contra la base de esta instancia.
10. `pnpm db:seed` — usuario admin temporal, catálogos base, herramientas/permisos/menúes del core (ver `desarrollo-local.md`).
11. Si usa Procesos: registrar en `pg_cron` 1 job evaluador + N jobs ejecutores (N = el del formulario), apuntando a las SPs correspondientes (ver `domain/procesos.md`).

## Fase 5 — Recursos específicos de este cliente

12. **Recursos estándar**: abrir `docs/project/catalogo-recursos-estandar.md` y, para cada recurso marcado en el formulario, correr su seed — **en el orden que respete las dependencias declaradas** en la columna "Depende de" de esa tabla (instalar primero los que otros dependen de ellos). Ej.: cliente en Argentina con el módulo `cotizaciones-argentina` contratado → `pnpm db:seed:configuracion-argentina` (recurso "Cotizaciones (Argentina)").
13. **Recursos custom**: si el formulario describe algún recurso a medida para este cliente (sin catálogo de por medio, ver ADR 0017), construirlo/cargarlo directo para esta instancia siguiendo la descripción del formulario — no hay un seed compartido que correr, es trabajo puntual de esta instalación.

## Fase 6 — Configuración de negocio inicial

14. Cargar `INTERFAZ` (nombre/título, colores, logo) con los valores del formulario.
15. Crear el usuario admin real de este cliente (o cambiar la contraseña del admin temporal del seed — nunca dejar la de desarrollo en una instancia real).

## Fase 7 — Verificación

16. Levantar la app y loguearse como admin. Confirmar que las herramientas esperadas (core + recursos elegidos) aparecen en el menú.
17. Si usa Procesos: `SELECT * FROM cron.job;` — confirmar que aparecen el evaluador y los N ejecutores, todos `active`.
18. Si usa Acciones Externas: probar el componente que tenga instalado — ej. `consulta_cotizacion` (Argentina): encolar una prueba (`encolarAccionExterna` contra la fila `consulta_cotizacion_ar` de `ACCIONES_EXTERNAS`) y confirmar en `ACCIONES_EXTERNAS_COLA` que `RESULTADO=0` y que aparecieron filas nuevas en `COTIZACIONES`. Cuando `email`/`webhook` estén implementados (sprint posterior), este paso se extiende a disparar un mail y/o webhook de prueba.
19. `pnpm build` (o el pipeline de CI si ya existe uno) antes de dar la instancia por lista para producción — ver la nota de seguridad de `runbooks/actualizaciones.md`.

## Lo que este manual todavía NO cubre

Marcado explícito para no generar falsa sensación de completitud — ver `docs/open-issues.md`:

- **Infraestructura de despliegue concreta** (Fly.io, Railway, VPS propio): no está definida a nivel de proyecto. Este manual asume que YA existe un servidor/hosting elegido para esta instancia, no lo elige por vos.
- **Estrategia de backups**: no está definida. No es parte de este checklist todavía.
- **Automatización del alta de `apps/<client-slug>`**: hoy es 100% manual (Fase 0), sin script.
