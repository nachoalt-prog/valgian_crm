# 0016 - Acciones externas: catálogo + cola, reusando Placeholders para el cuerpo del mail

## Estado

Aceptada — implementada (ver `domain/acciones-externas.md`), con revisiones sobre el mecanismo original (ver "Revisión" al final de este documento).

## Contexto

Un `PASO` de un `PROCESO` (ADR 0015) puede necesitar algo que Postgres no puede hacer solo: mandar un mail, pegarle a un webhook (a futuro, exportar/importar un archivo). El patrón para esto ya existía de forma implícita en el proyecto — `GENERACIONES_DOCUMENTO` es exactamente "SQL de confianza encola, un worker de Node drena la cola y hace el trabajo real" — pero nunca se generalizó a otras acciones fuera de Postgres.

Faltaba definir tres cosas concretas: cómo se manda un mail de verdad (no había ninguna infra de email en el proyecto), de dónde sale el cuerpo del mail, y si esta cola reintenta ante fallo.

## Decisión

**`ACCIONES_EXTERNAS`** (catálogo, qué acciones existen) + **`ACCIONES_EXTERNAS_COLA`** (cola, instancias puntuales a disparar) — mismo patrón catálogo/cola que ya usa el proyecto en todos lados (`PLANTILLAS_ADJUNTOS`/`GENERACIONES_DOCUMENTO`, `TIPOS_TRAMITE`/`TRAMITES`). Mecanismo de disparo: mismo trigger `AFTER INSERT` → `pg_notify` + worker Node con `LISTEN` + claim `FOR UPDATE SKIP LOCKED`, extendiendo `instrumentation-node.ts` — no se reusa la tabla `GENERACIONES_DOCUMENTO` en sí (ver ADR 0014, mismo razonamiento: columnas específicas y tipadas no generalizan bien a un concepto polimórfico), pero sí se extrae a código compartido la plomería de claim/trigger que ahora tienen tres consumidores (`GENERACIONES_DOCUMENTO`, `ACCIONES_EXTERNAS_COLA`, y el mecanismo de reintento).

**Infra de email**: `nodemailer` sobre SMTP, mismo criterio de portabilidad que el resto del proyecto (funciona con cualquier proveedor que ofrezca credenciales SMTP — Gmail/Exchange del cliente, Sendgrid, Resend, un relay propio — sin atar la instancia a un servicio externo puntual). Config de conexión SMTP vive en `.env` (`MODALIDAD_ENVIO_EMAIL` + credenciales), mismo criterio que ADR 0013. Un proveedor vía API (Resend/SendGrid) queda como rama preparada pero no implementada, mismo patrón que el punto de extensión S3 de ADR 0011 — se implementa el día que una instalación real lo necesite.

**Cuerpo del mail**: reusa `PLANTILLAS_ADJUNTOS` + el motor de `PLACEHOLDERS` ya construido para Generación de Documentos (`domain/generacion-documentos.md`). Una `ACCIONES_EXTERNAS` de tipo `email` referencia una `PLANTILLA_ADJUNTO` (HTML con `##CODIGO##`) por `ID_PLANTILLA` — mismo ABM, mismo motor de resolución, cero código nuevo de templating.

**Reintento**: sí, mismo criterio que `PROCESOS` (ADR 0015) — `REINTENTO_MINUTOS`/`REINTENTOS_MAX` por `ACCIONES_EXTERNAS`, con la misma lógica de "al fallar, insertar una fila nueva con `FECHA_PROGRAMADA` futura". Diferencia importante con Procesos: acá no hay un evaluador de cron corriendo cada minuto — el disparo primario es `LISTEN`/`NOTIFY` (casi en tiempo real), y `NOTIFY` solo dispara una vez, en el momento del `INSERT`. Una fila de reintento con `FECHA_PROGRAMADA` futura SÍ dispara el `NOTIFY` al insertarse, pero el worker no la va a reclamar hasta que su `FECHA_PROGRAMADA` llegue — así que el barrido de seguridad periódico (ya existente en el patrón de `GENERACIONES_DOCUMENTO`) es el que efectivamente la reclama cuando corresponde, no el `NOTIFY` original. La cadencia de ese barrido para esta cola tiene que ser lo bastante corta como para que `REINTENTO_MINUTOS` tenga sentido (los 15 minutos que usa hoy `GENERACIONES_DOCUMENTO` son demasiado gruesos para un reintento típico de webhook de 1-5 minutos) — se define en `domain/acciones-externas.md`.

## Alternativas consideradas

- **Fusionar `GENERACIONES_DOCUMENTO` dentro de `ACCIONES_EXTERNAS_COLA`**: descartado, ver ADR 0014 — mismo argumento, columnas específicas (`ID_PLANTILLA`/`ID_ENTIDAD`/`ID_REGISTRO`/`ID_ARCHIVO_RESULTADO`) no generalizan sin perder integridad referencial real.
- **Proveedor de email vía API en vez de SMTP**: descartado por ahora — ata la instalación a un servicio externo puntual, rompe el criterio de portabilidad ya aplicado en el resto del proyecto (ADR 0001, mismo argumento que descartó `pg_net`). Queda preparado, no implementado.
- **Mecanismo de templating propio para el cuerpo del mail** (en vez de reusar Placeholders): descartado — duplicaría un concepto ("plantilla HTML con variables resueltas por SQL") que el proyecto ya resolvió una vez, sin ninguna necesidad real distinta.
- **Sin reintento automático en esta cola** (mismo criterio que `GENERACIONES_DOCUMENTO` hoy): descartado — a diferencia de generar un PDF, mandar un mail o pegarle a un webhook falla seguido por motivos transitorios de red (timeout, 5xx, SMTP caído un rato), y dejarlo colgado hasta intervención manual es más fricción de la que vale la pena.

## Consecuencias

- Nueva infra real en el proyecto: conexión SMTP saliente, configurable por instalación.
- El worker de `ACCIONES_EXTERNAS_COLA` necesita su propio barrido de seguridad con cadencia más corta que el de 15 minutos de `GENERACIONES_DOCUMENTO` (a definir según `REINTENTO_MINUTOS` típicos esperados).
- Riesgo residual de envío duplicado si el proceso Node se cae justo después de efectivamente mandar el mail/pegarle al webhook, pero antes de confirmar `completado` — con reintento automático activado, ese resto de ejecución se volvería a intentar. Se documenta como riesgo aceptado (igual categoría que otros puntos del sistema que asumen at-least-once, no exactly-once), no se resuelve con un mecanismo de deduplicación en esta primera versión.
- Se extrae a código compartido en `packages/core` la plomería de cola (trigger + notify + claim + barrido de seguridad), ahora con tres consumidores reales (`GENERACIONES_DOCUMENTO`, `ACCIONES_EXTERNAS_COLA`, y transitivamente el patrón que usa `PROCESOS_EJECUCIONES` aunque ese vive en PL/pgSQL, no Node).

## Revisión (al momento de implementar)

Varias vueltas de diseño, ya al momento de escribir el código, cambiaron partes concretas de este ADR — se documentan acá en vez de reescribir la narrativa original de arriba (que sigue siendo válida como contexto/razonamiento):

- **Reintento in-place, no fila nueva**: un reintento ya no inserta una fila nueva con `ID_INTENTO_ORIGEN`/`FECHA_PROGRAMADA` — es la MISMA fila de `ACCIONES_EXTERNAS_COLA` reprocesada por el barrido mientras siga siendo elegible (`REINTENTO` se incrementa in-place). Más simple que el mecanismo original, y el `NOTIFY` nunca dependía de eso de todas formas (ver más abajo).
- **`NOTIFY` se mantiene, pero como disparador adicional de la misma función de barrido** — no se descartó a favor de un barrido puro (se evaluó esa opción y se descartó): el `NOTIFY` solo acelera el primer intento, nunca sirvió para los reintentos, así que sumarlo no complica nada del reintento in-place — es gratis reusar el mismo patrón que ya tiene `GENERACIONES_DOCUMENTO` (`LISTEN` + `setInterval` + pasada al arrancar, los tres llaman a la misma función).
- **El componente escribe su propio resultado** (`RESULTADO`/`RESULTADO_DESC`/`REQUEST`/`RESPONSE`), no un despachador genérico que reduce todo a un booleano — el despachador (`packages/core`) solo resuelve qué handler llamar (vía un registro `registrarHandlerAccionExterna`, nunca un import directo — ver regla de dependencia de módulos) y ofrece un helper compartido (`finalizarIntentoAccionExterna`) para la aritmética de reintento, que el handler llama él mismo.
- **`ACCIONES_EXTERNAS` ganó columnas** no contempladas originalmente: `PARAMETROS` (reemplaza `CONFIG`, mismo concepto, nombre consistente con el resto del proyecto), `TOKEN`/`TOKEN_EXPIRACION` (sesión con el servicio externo, mismo patrón que `USUARIOS`), `ACTIVO` (pausa manual, filtra en el barrido), `INMEDIATO` (creada, no usada todavía), `REINTENTOS_MARGEN` (ventana de tiempo para reintentar, además del tope `REINTENTOS_MAX`).
- **Los handlers no viven en `packages/core`**: el primer caso real (`consulta_cotizacion`, contra DolarApi) reveló que el catálogo de acciones externas es infraestructura genérica compartida por TODOS los clientes, pero un handler puntual (con su lógica de negocio y su tabla de dominio, ej. `MONEDAS`/`COTIZACIONES`) no necesariamente lo es — encaja en el patrón de módulo opcional de ADR 0012/`docs/contracts/modulo.md`, que hasta este momento estaba documentado pero nunca se había construido. `packages/modules/cotizaciones-argentina` es el primer módulo real de este monorepo.
