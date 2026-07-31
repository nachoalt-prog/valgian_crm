# Temas pendientes

Todo lo que está identificado pero no resuelto todavía, sin importar de qué subsistema se trate. Cuando algo se resuelve, sale de esta lista y su resolución pasa a vivir en `architecture/`, `domain/`, o como una ADR nueva en `decisions/`, según corresponda.

## Dominio

- **Editor visual de QUERY/COLUMNAS en el ABM de Bandejas/Filtros**: el ABM ya existe (`/dashboard/bandejas-admin`, `/dashboard/filtros`), pero `BANDEJAS.QUERY`/`COLUMNAS` y `FILTROS.QUERY` se cargan como SQL/JSON crudo en un textarea — no hay un query-builder visual. Queda como mejora futura, no bloqueante. (`domain/bandejas.md`)
- **`CUENTAS` sin ABM ni extensiones por producto**: la tabla existe (schema-only) desde la fase de Trámites, pero no tiene ABM, seed de datos, ni la estrategia/entidad del motor de estados wireada — y la idea original de tablas de extensión 1 a 1 por tipo de producto (`XP_CUENTAS`) no se retomó. (`domain/core.md`)
- **Parcialmente resuelto — Campo `FILE` en Trámites**: el Modal de Trámites ya tiene una solapa "Adjuntos" completa (adjuntos generales del trámite, reutilizando `ArchivosAdjuntosTool`) — ver `domain/archivos-adjuntos.md` y `domain/tramites.md`. Lo que sigue sin conectar es específicamente el campo de tipo `FILE` **dentro** del formulario dinámico de un trámite (`TIPOS_CAMPOS.CODIGO = 'FILE'`, `TRAMITES_CAMPOS_DATOS.ID_ARCHIVO_ADJUNTO`) — sigue mostrando un placeholder, no está conectado a `guardarArchivo`.

## Infraestructura

- **Resuelto — permisos más granulares que VER/GESTIONAR**: `PERMISOS.GESTIONAR` fue reemplazado por `OPERACIONES` (acciones concretas por herramienta) + `PERMISOS.ID_OPERACION` — ver `domain/infraestructura.md`, "Modelo de permisos". De momento la mayoría de las herramientas siguen con una única operación `acceso` (equivalente al viejo `GESTIONAR`); `LEGAJO_ADJ_1` es el primer caso con operaciones realmente finas (crear/reemplazar/descargar/guardar/borrar). Migrar otra herramienta a este nivel de detalle no requiere cambio de schema, solo sumarle sus propias filas en `OPERACIONES`.
- **Sesión única por usuario**: si se necesita soporte para múltiples sesiones simultáneas, hace falta introducir una tabla `SESIONES` — ver ADR 0010.

## Módulos

- **Módulo de mensajería** (`MSJ_CANALES`, `MSJ_MODELOS`, `MSJ_TAGS`, `MSJ_COLA`): deliberadamente pospuesto hasta tener el core andando. Se retoma en una pasada posterior.
- **Contrato de módulos** (`contracts/modulo.md`): todavía no escrito — pendiente definir qué debe cumplir cualquier módulo para engancharse al core (registro de `HERRAMIENTAS`, entradas en `MENUES_OPCIONES`, uso del patrón `ID_ENTIDAD`/`ID_RELACION`).

## Infraestructura de despliegue

- **Infraestructura de despliegue concreta** para las instancias de cliente (Fly.io, Railway, VPS propio) — no definida.
- **Estrategia de backups por instancia** — no definida. Debe cubrir tanto la base de datos como el volumen de archivos (`uploads/`) introducido en ADR 0011.
- **Plan SaaS liviano compartido**: si en algún momento se ofrece uno para clientes chicos, y cómo convive con el modelo instancia-por-cliente (ADR 0001) — no evaluado.
