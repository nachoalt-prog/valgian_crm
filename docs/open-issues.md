# Temas pendientes

Todo lo que está identificado pero no resuelto todavía, sin importar de qué subsistema se trate. Cuando algo se resuelve, sale de esta lista y su resolución pasa a vivir en `architecture/`, `domain/`, o como una ADR nueva en `decisions/`, según corresponda.

## Dominio

- **Editor visual de QUERY/COLUMNAS en el ABM de Bandejas/Filtros**: el ABM ya existe (`/dashboard/bandejas-admin`, `/dashboard/filtros`), pero `BANDEJAS.QUERY`/`COLUMNAS` y `FILTROS.QUERY` se cargan como SQL/JSON crudo en un textarea — no hay un query-builder visual. Queda como mejora futura, no bloqueante. (`domain/bandejas.md`)
- **Parcialmente resuelto — Campo `FILE` en Trámites**: el Modal de Trámites ya tiene una solapa "Adjuntos" completa (adjuntos generales del trámite, reutilizando `ArchivosAdjuntosTool`) — ver `domain/archivos-adjuntos.md` y `domain/tramites.md`. Lo que sigue sin conectar es específicamente el campo de tipo `FILE` **dentro** del formulario dinámico de un trámite (`TIPOS_CAMPOS.CODIGO = 'FILE'`, `TRAMITES_CAMPOS_DATOS.ID_ARCHIVO_ADJUNTO`) — sigue mostrando un placeholder, no está conectado a `guardarArchivo`.

## Infraestructura

- **Resuelto — permisos más granulares que VER/GESTIONAR**: `PERMISOS.GESTIONAR` fue reemplazado por `OPERACIONES` (acciones concretas por herramienta) + `PERMISOS.ID_OPERACION` — ver `domain/infraestructura.md`, "Modelo de permisos". De momento la mayoría de las herramientas siguen con una única operación `acceso` (equivalente al viejo `GESTIONAR`); `LEGAJO_ADJ_1` es el primer caso con operaciones realmente finas (crear/reemplazar/descargar/guardar/borrar). Migrar otra herramienta a este nivel de detalle no requiere cambio de schema, solo sumarle sus propias filas en `OPERACIONES`.
- **Sesión única por usuario**: si se necesita soporte para múltiples sesiones simultáneas, hace falta introducir una tabla `SESIONES` — ver ADR 0010.

## Motor de importación de archivos

Implementado completo (motor, ABM de `IMPORTADORES`, wizard genérico, y el primer importador real — Legajos y Clientes) — ver ADR 0021, `domain/importadores.md`. Pendiente:

- **UI (ABM y wizard) sin probar en browser real** — verificado a fondo del lado del servidor en las 3 fases (carga, validación, paginación, confirmación, guard de concurrencia, cancelación, upserts reales de `LEGAJOS`/`CLIENTES`), pero la interacción real en pantalla (`/dashboard/importadores`, `/dashboard/importar`) todavía no la probó nadie.
- **SFTP como origen de archivo en modo automático**: deliberadamente pospuesto (ver ADR 0021) — no hay precedente de credenciales/secrets en el repo. Se engancharía como una etapa 0 que deja el archivo en el directorio local configurado, sin tocar el resto del motor.
- **`legajos_clientes` se sembró sin `RUTA_DIRECTORIO`** (`DISPARO_AUTOMATICO_ACTIVO=false`) — cada instalación que quiera usarlo en modo automático tiene que configurar la ruta desde el ABM primero.

## Módulos

- **Módulo de mensajería** (`MSJ_CANALES`, `MSJ_MODELOS`, `MSJ_TAGS`, `MSJ_COLA`): deliberadamente pospuesto hasta tener el core andando. Se retoma en una pasada posterior.
- **Servicio de feriados para `FERIADOS`**: las tablas core `FERIADOS`/`TIPOS_FERIADO` (agregadas para el motor de cálculo de Cuenta Corriente, ver `domain/cuenta-corriente.md`, aunque son genéricas y no exclusivas de ese módulo) tienen `TIPOS_FERIADO` como catálogo real y permanente (siempre sembrado), pero las filas puntuales de `FERIADOS` hoy son solo datos de PRUEBA cargados a mano. Falta un módulo separado que consuma un servicio diario (API de feriados) y puebla `FERIADOS` automáticamente — no evaluado todavía qué servicio usar.
- **Módulo Cuenta Corriente (XCC) — alta de cuentas nuevas, deliberadamente fuera de alcance por ahora**: hoy una cuenta solo se crea por seed. Decisión del usuario: se va a resolver por wizard, importación o webservice más adelante, no por un ABM de alta manual — queda anotado para cuando esas piezas existan, no es una tarea suelta.
- **Módulo Cuenta Corriente (XCC) — no existe forma real de cargar un movimiento todavía**: `XCC_MOVIMIENTOS` hoy solo se llena por seed/script (`seed-demo.ts`), nunca desde una pantalla — no hay ABM de carga. Ligado a esto, `NRO_RECIBO` (campo libre en `XCC_MOVIMIENTOS`) está vacío en todos los movimientos de demo porque nada lo genera: no existe el "motor genérico de pagos" que la sección 1 de `domain/cuenta-corriente.md` da por sentado (`CATEGORIAS_PRODUCTOS.SP_PAGO`/`SP_ANULAR_PAGO` existen como columnas y tienen ABM para configurarlas — `categoria-producto-dialog.tsx` —, pero la categoría "Cuentas" los tiene en `NULL` y no hay ningún motor que los invoque todavía). Hace falta definir: quién dispara la carga de un movimiento (¿un trámite, vía `XCC_MOVIMIENTOS.ID_TRAMITE`? ¿una pantalla directa?), cómo/cuándo se genera `NRO_RECIBO`, y recién ahí escribir el primer `sp_pago`/`sp_anular_pago` real para XCC.

## Infraestructura de despliegue

- **Infraestructura de despliegue concreta** para las instancias de cliente (Fly.io, Railway, VPS propio) — no definida.
- **Estrategia de backups por instancia** — no definida. Debe cubrir tanto la base de datos como el volumen de archivos (`uploads/`) introducido en ADR 0011.
- **Plan SaaS liviano compartido**: si en algún momento se ofrece uno para clientes chicos, y cómo convive con el modelo instancia-por-cliente (ADR 0001) — no evaluado.
