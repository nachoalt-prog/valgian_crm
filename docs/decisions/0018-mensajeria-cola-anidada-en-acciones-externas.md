# 0018 - Mensajería: cola anidada bajo Acciones Externas, contrato compartido de componente

## Estado

Aceptada — implementada (ver `domain/acciones-externas.md`, sección Mensajería).

## Contexto

`ACCIONES_EXTERNAS`/`ACCIONES_EXTERNAS_COLA` (ADR 0016) resuelven "una acción, un disparo" — perfecto para `consulta_cotizacion` (un disparo, un puñado de llamadas internas, un resultado agregado). Mensajería es otro animal: un mismo proveedor (SMTP, SMS, WhatsApp) puede necesitar mandar **muchos mensajes independientes**, cada uno con su propio destinatario, su propio historial de reintento, y potencialmente su propio disparo (`INMEDIATO=true`, uno por mensaje) o agrupados en un solo disparo por lote (`INMEDIATO=false`, pensado para cuando exista Procesos). Meter esa granularidad dentro de `ACCIONES_EXTERNAS_COLA` habría significado volver a la fila-por-intento que ya se descartó en ADR 0016, o perder la posibilidad de reintentar un mensaje puntual sin reintentar el lote entero.

También hacía falta resolver: cómo entra un mensaje al ciclo de vida de una entidad de negocio (ej. "avisale al legajo que se resolvió el trámite, y marcalo como notificado"), y quién construye el contenido final (asunto + cuerpo con placeholders + adjuntos) sin duplicar código entre proveedores.

## Decisión

**Segundo nivel de cola**: `MENSAJERIA_COLA` (un mensaje = una fila) referencia `ACCIONES_EXTERNAS` (qué proveedor lo manda), no `ACCIONES_EXTERNAS_COLA` — un mensaje puede quedar encolado bastante antes de que exista ningún disparo. Lleva sus PROPIAS `REINTENTO`/`REINTENTOS_SUPERADOS`/`RESULTADO` (mismo criterio 0=éxito que `ACCIONES_EXTERNAS_COLA`, ADR 0016) — reintentar un mensaje nunca reintenta el lote completo, ni viceversa.

**`MENSAJERIA_PLANTILLAS`**: catálogo de contenido (HTML vía `ARCHIVOS_ADJUNTOS`, mismo patrón que `PLANTILLAS_ADJUNTOS`) + `ASUNTO` (también con placeholders) + `ID_ESTIMULO_OK`/`ID_ESTIMULO_ERROR` — engancha mensajería directo al motor de estados: al mandar con éxito, o al agotar los reintentos de un mensaje en particular, se aplica el estímulo configurado sobre `(MENSAJERIA_COLA.ID_ENTIDAD, MENSAJERIA_COLA.ID_REGISTRO)` vía `sp_aplicar_estimulo` (ADR existente del motor de estados) — sin código nuevo de orquestación de estados, se reusa tal cual.

**`SP_MENSAJERIA_ENCOLAR`**: `PROCEDURE` (SQL de confianza, ADR 0009) que inserta `MENSAJERIA_COLA` + `MENSAJERIA_COLA_ADJUNTOS`, y si `ACCIONES_EXTERNAS.INMEDIATO=true`, dispara también `ACCIONES_EXTERNAS_COLA` (con `ID_ENTIDAD`=la entidad `mensajeria_cola` e `ID_REGISTRO`=el `MENSAJERIA_COLA.ID` recién creado) — esa combinación es la señal que el despachador usa para saber "procesá SOLO este mensaje" en vez de "barré todos los pendientes de esta acción".

**`DATOS_RAIZ` separado de `PLACEHOLDERS`**: la SP no puede resolver placeholders (es SQL, `resolverPlaceholders` es Node) — persiste el `datos` crudo del llamador en `DATOS_RAIZ`. El componente, al mandar, resuelve contra eso y escribe el mapa YA resuelto en `PLACEHOLDERS`, para auditoría — dos columnas, no una reusada en dos momentos (se evaluó y se descartó, ver Alternativas).

**Contrato compartido de componente** (`packages/core/src/mensajeria.ts`, función `procesarComponenteMensajeria`): TODO lo genérico (detectar modo mensaje-específico vs. barrido de lote, resolver plantilla + placeholders de cuerpo y asunto + adjuntos, bookkeeping de reintento, aplicación de estímulos) vive acá, una sola vez. Cada proveedor (SMTP, a futuro SMS/WhatsApp) implementa únicamente `EnviarUnMensaje` — la función que sabe hablar con SU servicio puntual — y se registra vía `registrarHandlerAccionExterna` (mismo mecanismo de ADR 0016, el core nunca importa el módulo).

**Segundo módulo real**: `packages/modules/mensajeria-smtp` (nodemailer sobre SMTP genérico, credenciales en `ACCIONES_EXTERNAS.PARAMETROS`, no en `.env` — a diferencia del resto de la config de infraestructura, ADR 0013, acá puede haber más de un proveedor SMTP configurado a la vez).

## Alternativas consideradas

- **Guardar `DATOS_RAIZ` y `PLACEHOLDERS` en la misma columna** (crudo al encolar, sobreescrito con lo resuelto al mandar): descartado — se pierde el dato crudo original apenas se resuelve, sin ganar nada a cambio de la columna extra.
- **`MENSAJERIA_COLA` referenciando `ACCIONES_EXTERNAS_COLA` en vez de `ACCIONES_EXTERNAS`** (para mantener la regla estructural de trazabilidad de ADR 0016 al pie de la letra): descartado — un mensaje puede existir sin que todavía exista ningún disparo (`INMEDIATO=false`), así que esa FK no tendría qué apuntar en ese momento. La trazabilidad real hacia el disparo puntual que procesó un mensaje se reconstruye consultando `ACCIONES_EXTERNAS_COLA` por `(ID_ENTIDAD='mensajeria_cola', ID_REGISTRO=<id del mensaje>)`, sin necesitar una columna aparte.
- **Despachador genérico decide éxito/error y escribe el resultado** (como se pensó originalmente para `consulta_cotizacion`, ver ADR 0016): descartado para mensajería — con N mensajes por disparo, cada uno necesita decidir y escribir SU propio resultado; forzar todo a través de un despachador que solo ve un booleano agregado pierde el detalle por mensaje que es justamente el punto de tener `MENSAJERIA_COLA`.
- **Handlers de mensajería sin contrato compartido** (cada proveedor reimplementa resolución de plantilla + bookkeeping): descartado — es exactamente el código que se repetiría entre SMTP/SMS/WhatsApp sin aportar nada distinto por proveedor; `procesarComponenteMensajeria` lo centraliza una sola vez.

## Consecuencias

- `packages/core/src/placeholders.ts` gana un campo nuevo en su resultado (`valores: Record<string,string>`, el mapa de sustituciones) — cambio aditivo, no rompe a `GENERACIONES_DOCUMENTO`, el único consumidor previo.
- `packages/core/src/motor-estados.ts` afloja el tipo de `idUsuario` en `aplicarEstimulo` a `string | null` — mensajería aplica estímulos sin un usuario logueado detrás (mismo criterio que `guardarArchivo` para Generación de Documentos).
- Nuevo tipo de columna en el motor de Reportes (`tipo: "adjuntos"`, ver ADR 0014) — un botón que abre un diálogo de solo lectura con los adjuntos de la fila. Vocabulario de columnas ampliado exactamente como ADR 0014 preveía que pasaría.
- `ENTIDADES` gana una fila (`mensajeria_cola`) que rompe la convención previa de `NOMBRE` = nombre de tabla en mayúsculas — deliberado, esta entidad nunca se usa como nombre de tabla dinámico (`sp_aplicar_estimulo` no la toca), solo la compara el despachador por `ID`.
