# Temas pendientes

Todo lo que está identificado pero no resuelto todavía, sin importar de qué subsistema se trate. Cuando algo se resuelve, sale de esta lista y su resolución pasa a vivir en `architecture/`, `domain/`, o como una ADR nueva en `decisions/`, según corresponda.

## Dominio

- **Editor visual de QUERY/COLUMNAS en el ABM de Bandejas/Filtros**: el ABM ya existe (`/dashboard/bandejas-admin`, `/dashboard/filtros`), pero `BANDEJAS.QUERY`/`COLUMNAS` y `FILTROS.QUERY` se cargan como SQL/JSON crudo en un textarea — no hay un query-builder visual. Queda como mejora futura, no bloqueante. (`domain/bandejas.md`)
- **`CUENTAS` sin ABM ni extensiones por producto**: la tabla existe (schema-only) desde la fase de Trámites, pero no tiene ABM, seed de datos, ni la estrategia/entidad del motor de estados wireada — y la idea original de tablas de extensión 1 a 1 por tipo de producto (`XP_CUENTAS`) no se retomó. (`domain/core.md`)
- **Adjuntos en Trámites**: `TIPOS_CAMPOS.CODIGO = 'FILE'` y `TRAMITES_CAMPOS_DATOS.ID_ARCHIVO_ADJUNTO` existen en el schema, pero no hay tabla `ARCHIVOS_ADJUNTOS` ni carga/guardado real todavía — el Modal de Trámites muestra un placeholder para campos tipo `FILE`. (`domain/tramites.md`)

## Infraestructura

- **Permisos más granulares que VER/GESTIONAR**: si se necesita distinguir, por ejemplo, editar de eliminar, `PERMISOS` debe expandirse con más flags o columnas. (`domain/infraestructura.md`)
- **Sesión única por usuario**: si se necesita soporte para múltiples sesiones simultáneas, hace falta introducir una tabla `SESIONES` — ver ADR 0010.

## Módulos

- **Módulo de mensajería** (`MSJ_CANALES`, `MSJ_MODELOS`, `MSJ_TAGS`, `MSJ_COLA`): deliberadamente pospuesto hasta tener el core andando. Se retoma en una pasada posterior.
- **Contrato de módulos** (`contracts/modulo.md`): todavía no escrito — pendiente definir qué debe cumplir cualquier módulo para engancharse al core (registro de `HERRAMIENTAS`, entradas en `MENUES_OPCIONES`, uso del patrón `ID_ENTIDAD`/`ID_RELACION`).

## Infraestructura de despliegue

- **Infraestructura de despliegue concreta** para las instancias de cliente (Fly.io, Railway, VPS propio) — no definida.
- **Estrategia de backups por instancia** — no definida. Debe cubrir tanto la base de datos como el volumen de archivos (`uploads/`) introducido en ADR 0011.
- **Plan SaaS liviano compartido**: si en algún momento se ofrece uno para clientes chicos, y cómo convive con el modelo instancia-por-cliente (ADR 0001) — no evaluado.
