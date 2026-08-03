# Dominio — Acciones Externas

Puente entre SQL de confianza (`ACCIONES.COMANDO`, o cualquier otro que lo necesite) y trabajo que Postgres no puede hacer solo: pegarle a un webservice, mandar un mail, etc. El disparador solo hace un `INSERT` en `ACCIONES_EXTERNAS_COLA` y sigue de largo — el trabajo real ocurre después, de forma asincrónica, en el worker de Node. Ver ADR 0016 para el razonamiento completo (incluida la historia de por qué el mecanismo terminó siendo distinto al planteado originalmente ahí).

`ACCIONES_EXTERNAS`/`ACCIONES_EXTERNAS_COLA` son **puramente infraestructura** — nunca guardan datos de dominio. Cualquier `COMPONENTE` que produzca datos reales (ej. una cotización) los guarda en su propia tabla, con una FK de vuelta a la fila de cola que la generó (trazabilidad — ver "Regla estructural" más abajo).

## Tablas (core, `packages/db`)

### ACCIONES_EXTERNAS (catálogo)

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| CODIGO | string, unique |
| NOMBRE | string |
| COMPONENTE | string — cerrado, mapea a un handler Node registrado a mano (ver "Componentes" más abajo). Hoy `'consulta_cotizacion'` y `'mensajeria_smtp'` |
| PARAMETROS | jsonb — parámetros FIJOS que el despachador le pasa al handler (credenciales, config propia del componente). Distinto de `ACCIONES_EXTERNAS_COLA.PARAMETROS` (dinámico, por llamada) |
| TOKEN | string, nullable — sesión con el servicio externo, cuando el `COMPONENTE` la necesita (mismo patrón que `USUARIOS.TOKEN`) |
| TOKEN_EXPIRACION | timestamp, nullable |
| ACTIVO | boolean — si es `false`, el barrido no reclama filas pendientes de esta acción aunque existan (pausa manual) |
| INMEDIATO | boolean — si el disparo es por evento (cada llamador encola al toque) o delegado a un proceso batch que encola una sola vez. Lo leen `sp_mensajeria_encolar`/`sp_encolar_mensaje_sin_commit` para decidir si insertan además una fila en `ACCIONES_EXTERNAS_COLA` al encolar un mensaje — ver "Mensajería" más abajo. `p_forzar_inmediato` (ambos SPs) puede pisar este valor puntualmente sin tocar la fila de `ACCIONES_EXTERNAS` |
| MENSAJERIA | boolean, default `false` — si esta acción aparece en el combo de proveedores de mensajería (ej. el modal de "Probar" de Plantillas de Mensajería, filtra junto con `ACTIVO`). No tiene nada que ver con `COMPONENTE`: es una etiqueta aparte para no tener que hardcodear en código qué `COMPONENTE`s son "de mensajería" |
| REINTENTOS_MAX | integer, nullable — tope de reintentos |
| REINTENTOS_MARGEN | integer, nullable — minutos de margen desde `FECHA_ENCOLADO`; pasado ese margen, no se reintenta más aunque no se haya llegado a `REINTENTOS_MAX`. `NULL` = sin límite de tiempo (solo manda `REINTENTOS_MAX`) |

### ACCIONES_EXTERNAS_COLA

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_ACCION_EXTERNA | FK → ACCIONES_EXTERNAS |
| FECHA_ENCOLADO | timestamp, `DEFAULT now()` — un `DEFAULT` de columna ya cubre "usar el valor si viene en el INSERT, si no `now()`", no hace falta un trigger para esto |
| RESULTADO | integer, nullable — `null` = no intentado, `0` = éxito, cualquier otro valor = error (el componente elige el código) |
| RESULTADO_DESC | text, nullable — descripción del resultado, la arma el componente |
| RESULTADO_FECHA | timestamp, nullable — cuándo fue ESE intento puntual |
| REINTENTO | integer, default 0 — se incrementa EN LA MISMA fila en cada intento (no se crea una fila nueva por reintento) |
| REINTENTOS_SUPERADOS | boolean, default false — `true` = no se reintenta más (tope alcanzado, margen vencido, o cancelado a mano) |
| TIEMPO_CONEXION | integer, nullable — milisegundos que tardó el intento |
| ID_ENTIDAD | FK → ENTIDADES, nullable — para llamados simples, el componente busca el dato solo |
| ID_REGISTRO | UUID, nullable, sin FK (asociación polimórfica, mismo criterio que `ARCHIVOS_ADJUNTOS.ID_REGISTRO`) |
| PARAMETROS | jsonb, nullable — para llamados complejos, quien encola pasa los pares clave/valor que el componente necesita |
| REQUEST | jsonb, nullable — el componente puede loguear acá el request completo que mandó |
| RESPONSE | jsonb, nullable — el componente puede loguear acá el response completo que recibió |

**Regla estructural** (no solo para `COTIZACIONES`): toda tabla de dominio que se actualice como resultado de una acción externa lleva una FK nullable de vuelta a `ACCIONES_EXTERNAS_COLA`. El despachador siempre le pasa el `ID` de la fila de cola al handler para que la estampe.

## Mecanismo

### Disparo — `NOTIFY` + barrido, los dos alimentan la misma función

Un trigger `AFTER INSERT` en `ACCIONES_EXTERNAS_COLA` dispara `pg_notify('acciones_externas_cola', NEW."ID"::text)` (`packages/db/sql/0007_trigger_notify_acciones_externas_cola.sql`). El worker de Node (`apps/web/src/instrumentation-node.ts`) mantiene una conexión `LISTEN` — mismo patrón que ya usa `GENERACIONES_DOCUMENTO`: `LISTEN` (reacciona casi al instante) + `setInterval` cada 1 minuto (barrido de seguridad) + una pasada al arrancar el proceso, **los tres llamando a la misma función de barrido**.

El `NOTIFY` solo acelera el **primer intento** de una fila recién encolada — nunca importó para los reintentos, ni en este diseño ni en el original: un reintento es la MISMA fila reprocesada in-place en la siguiente pasada del barrido que la encuentre elegible, no una fila nueva que dispare su propio `NOTIFY` en el momento correcto.

### La función de barrido

1. `SELECT` sobre `ACCIONES_EXTERNAS_COLA` con `JOIN` a `ACCIONES_EXTERNAS`, condición:
   `(RESULTADO IS NULL OR RESULTADO != 0) AND REINTENTOS_SUPERADOS = false AND ACTIVO = true AND (REINTENTOS_MARGEN IS NULL OR FECHA_ENCOLADO >= now() - REINTENTOS_MARGEN minutos)`.
   El `RESULTADO IS NULL OR ...` es necesario porque en SQL `NULL != 0` da `UNKNOWN`, no `TRUE` — una condición ingenua `WHERE RESULTADO != 0` excluiría en silencio las filas nunca intentadas.
2. Dispara el handler correspondiente de cada fila elegible **en paralelo** (`Promise.allSettled`, no secuencial).
3. Cada handler hace su trabajo y, al terminar (éxito o error), llama a `finalizarIntentoAccionExterna(idCola, resultado)` — centraliza el cálculo de `REINTENTO`/`REINTENTOS_SUPERADOS` contra `REINTENTOS_MAX`/`REINTENTOS_MARGEN` de `ACCIONES_EXTERNAS`, así esa aritmética no se duplica en cada handler. El handler solo decide QUÉ pasó (`resultado`/`resultadoDesc`/`request`/`response`), nunca cuántas veces reintentar.

**Riesgo aceptado**: no hay un estado intermedio tipo "procesando" — una fila cuyo handler tarda más de un ciclo del barrido podría, en teoría, ser reclamada dos veces por dos pasadas superpuestas. No es un problema para el único componente de este sprint (unos pocos `GET` rápidos). Si en algún momento hace falta la garantía fuerte, se resuelve con un lock de fila (`FOR UPDATE SKIP LOCKED` sostenido durante el intento) sin cambiar nada más de este diseño.

## Componentes

Un `COMPONENTE` es un handler Node registrado a mano — nunca código arbitrario. **`ACCIONES_EXTERNAS`/`ACCIONES_EXTERNAS_COLA` viven en `@valgian/core`, pero los handlers casi siempre viven en un módulo opcional** (`packages/modules/<nombre>`, ver `docs/contracts/modulo.md`) — `@valgian/core` nunca puede importar un módulo (regla de dependencia no negociable), así que el registro es explícito:

```ts
// packages/core/src/acciones-externas.ts
export function registrarHandlerAccionExterna(componente: string, handler: HandlerAccionExterna): void
```

Cada módulo llama a esto al arrancar (hoy, directo en `apps/web/src/instrumentation-node.ts` — no existe todavía el bootstrap genérico `apps/<client>/src/modules.ts`/`registrarModulo` de ADR 0012, se construye cuando haya un segundo módulo real que lo necesite).

### `consulta_cotizacion` — primer componente real

`packages/modules/cotizaciones-argentina` (primer módulo real de este monorepo). El handler `consultarCotizacion`:

1. Trae todas las filas de `MONEDAS` con `CODIGO_API` no nulo (`listMonedasConCodigoApi`, `packages/core/src/monedas.ts`) — sin lista hardcodeada, sumar un tipo nuevo es una fila nueva en `MONEDAS`, cero cambio de código.
2. Por cada una, `GET https://dolarapi.com/v1/dolares/{CODIGO_API}` (gratis, sin autenticación).
3. Inserta en `COTIZACIONES` (`crearCotizacion`) las que salieron bien, con `ID_ACCION_EXTERNA_COLA` para trazabilidad.
4. Si falló alguna, sigue con las demás — pero al final reporta error igual (`RESULTADO != 0`, `RESULTADO_DESC` detalla cuáles fallaron). `REQUEST`/`RESPONSE` quedan como objeto keyed por `MONEDAS.CODIGO`.

## MONEDAS / COTIZACIONES (core)

### MONEDAS

Un registro por tipo de cotización — no un `TIPO` sobre un único "USD" (cada variante del dólar es semánticamente distinta, no un sub-tipo).

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| CODIGO | string, unique |
| NOMBRE | string |
| CODIGO_API | string, nullable — identificador con el que la fuente externa reconoce este registro (hoy, el path de DolarApi). `NULL` = no se consulta a ninguna API (ej. `ARS`) |

Seed (`packages/core/src/seed-configuracion-argentina.ts`, `pnpm db:seed:configuracion-argentina` — **exclusivo de clientes en Argentina**, separado de `seed-config.ts` porque estos tipos de dólar son una particularidad del mercado argentino, no algo genérico):

| CODIGO | NOMBRE | CODIGO_API |
|---|---|---|
| `ARS` | Peso Argentino | *(null)* |
| `USD` | Dolar | `oficial` |
| `USD_BLUE` | Dólar Blue | `blue` |
| `USD_BOLSA` | Dólar Bolsa | `bolsa` |
| `USD_CCL` | Dólar CCL | `contadoconliqui` |
| `USD_MAY` | Dólar Mayorista | `mayorista` |

### COTIZACIONES

Histórico — cada consulta inserta filas nuevas, nunca actualiza una existente.

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_MONEDA | FK → MONEDAS |
| COMPRA / VENTA | double precision |
| FECHA_CONSULTA | timestamp — cuándo se hizo ESA consulta puntual |
| ID_ACCION_EXTERNA_COLA | FK nullable → ACCIONES_EXTERNAS_COLA — trazabilidad |

### ABM de Monedas (`/dashboard/monedas`, `HERRAMIENTAS.CODIGO = 'monedas'`)

Vive en `apps/web`, **no** en `packages/modules/cotizaciones-argentina` — `MONEDAS` es tabla de core, así que su ABM sigue el mismo criterio que cualquier otro ABM de una tabla de core (Filtros, Tipos de Adjunto, etc.), no el de un módulo. Un módulo tampoco podría contener hoy este tipo de pantalla aunque quisiera: no existe todavía un paquete compartido de componentes de UI del que un módulo pueda importar `Button`/`Table`/`Dialog` — esos viven solo dentro de `apps/web`.

CRUD estándar (`packages/core/src/monedas.ts`: `listMonedasAdmin`, `createMoneda`, `updateMoneda`, `deleteMoneda`) — `deleteMoneda` bloquea el borrado si hay alguna fila de `COTIZACIONES` con esa `ID_MONEDA` (mismo patrón que `deleteTipoArchivoAdjunto`/`deleteReporte`). Editar `CODIGO_API` desde acá es exactamente cómo se suma un tipo de cotización nuevo sin tocar código (ej. `USD_CRIPTO` → `CODIGO_API = 'cripto'`) — el handler `consultarCotizacion` lo recoge solo en la siguiente pasada del barrido.

### Reporte "Cotizaciones"

Reusa el motor de Reportes (ADR 0014) tal cual — cero código nuevo, solo datos (`packages/core/src/seed-config.ts`, junto al reporte de Auditoría de Generación de Documentos). Columnas: Moneda (`MONEDAS.NOMBRE`), Valor Venta, Valor Compra, Fecha. Filtros: Moneda (`select`, opciones de `MONEDAS`) y Fecha de Cotización (`fecha_rango` sobre `COTIZACIONES.FECHA_CONSULTA`).

La query del reporte es genérica (no menciona nada de Argentina) — vive en `seed-config.ts`, no en `seed-configuracion-argentina.ts`, porque lo específico de Argentina es solo qué `MONEDAS` existen, no el reporte en sí. Funcionaría igual para cualquier país que sume su propio módulo de consulta de cotizaciones el día de mañana.

## Cómo lo alimenta un caller (ej. un futuro PASO de Procesos)

```sql
INSERT INTO "ACCIONES_EXTERNAS_COLA" ("ID_ACCION_EXTERNA")
VALUES ((SELECT "ID" FROM "ACCIONES_EXTERNAS" WHERE "CODIGO" = 'consulta_cotizacion_ar'))
```

El `INSERT` es instantáneo — quien encola no espera respuesta, sigue de largo apenas confirma.

## Mensajería

Segundo nivel de cola, anidado bajo `ACCIONES_EXTERNAS`/`ACCIONES_EXTERNAS_COLA` — ver ADR 0018 para el razonamiento completo (por qué es un segundo nivel y no una fila más de `ACCIONES_EXTERNAS_COLA`). Un mismo proveedor (SMTP, a futuro SMS/WhatsApp) puede mandar muchos mensajes independientes, cada uno con su propio destino de reintento.

### MENSAJERIA_PLANTILLAS (catálogo, `ABM /dashboard/mensajeria-plantillas`)

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| CODIGO | string, unique |
| NOMBRE | string |
| ID_ARCHIVO_ADJUNTO | FK → ARCHIVOS_ADJUNTOS — HTML del cuerpo, con `##CODIGO##` (mismo mecanismo que `PLANTILLAS_ADJUNTOS`) |
| DESCRIPCION | string, nullable |
| ASUNTO | string, nullable — también admite `##CODIGO##`, se resuelve con el mismo motor que el cuerpo |
| COMODIN | jsonb, nullable |
| ID_ESTIMULO_OK | FK → ESTIMULOS, nullable |
| OBSERVACION_OK | string, nullable |
| ID_ESTIMULO_ERROR | FK → ESTIMULOS, nullable |
| OBSERVACION_ERROR | string, nullable |

Al mandar con éxito, si `ID_ESTIMULO_OK` está configurado, se aplica ese estímulo sobre `(MENSAJERIA_COLA.ID_ENTIDAD, MENSAJERIA_COLA.ID_REGISTRO)` vía `sp_aplicar_estimulo`, con `OBSERVACION_OK` como observación. `ID_ESTIMULO_ERROR` se aplica **recién cuando `MENSAJERIA_COLA.REINTENTOS_SUPERADOS` pasa a `true`** — nunca en cada intento fallido individual, solo cuando ya no se va a reintentar más. Sin usuario logueado detrás (`aplicarEstimulo` con `idUsuario=null` — mismo criterio que `guardarArchivo` en Generación de Documentos).

ABM (`packages/core/src/mensajeria-plantillas.ts`, calcado de `plantillas-adjunto.ts`): CRUD estándar + carga del HTML (igual mecánica que Plantillas de Documento — el archivo se reemplaza abriendo la plantilla desde el listado, no desde el diálogo de alta/edición). El selector de Estímulo usa `listEstimulosConEstrategia()` (ya existía, de Perfiles-Estímulos) — lista TODOS los estímulos de TODAS las estrategias, porque una plantilla no está atada a una sola estrategia (se usa contra cualquier `ID_ENTIDAD`/`ID_REGISTRO` que le pase el que encola).

### MENSAJERIA_COLA (cada fila = un mensaje)

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_ACCION_EXTERNA | FK → ACCIONES_EXTERNAS — qué proveedor lo manda. NO es `ACCIONES_EXTERNAS_COLA`: un mensaje puede quedar encolado antes de que exista ningún disparo (ver ADR 0018) |
| ID_MENSAJERIA_PLANTILLA | FK → MENSAJERIA_PLANTILLAS |
| ID_ENTIDAD | FK → ENTIDADES, nullable |
| ID_REGISTRO | UUID, nullable, sin FK (asociación polimórfica, mismo criterio que `ARCHIVOS_ADJUNTOS.ID_REGISTRO`) |
| ASUNTO | string, nullable — copia de `MENSAJERIA_PLANTILLAS.ASUNTO` al encolar, todavía sin resolver |
| DESTINO | string, nullable — a dónde mandarlo (mail, teléfono, lo que pida el proveedor). Cada `COMPONENTE` lo interpreta a su manera, la cola no le da formato |
| PLACEHOLDERS_DATOS_RAIZ | jsonb, nullable — datos raíz para resolver placeholders desde cero (mismo rol que `GENERACIONES_DOCUMENTO.DATOS`), los guarda `sp_mensajeria_encolar`/`sp_encolar_mensaje_sin_commit` cuando el llamador NO pasa `PLACEHOLDERS` ya resuelto. Antes se llamaba `DATOS_RAIZ` — renombrada para que el nombre deje claro el vínculo con `PLACEHOLDERS` |
| PLACEHOLDERS | jsonb, nullable — **doble rol**: (a) si viene `NULL` al encolar (caso de siempre), el componente resuelve desde `PLACEHOLDERS_DATOS_RAIZ` y recién ACÁ escribe el mapa `código -> valor` al mandar, para auditoría; (b) si viene YA poblado al encolar (ej. el modal de "Probar" de una Plantilla de Mensajería, donde el valor de cada placeholder lo tipea una persona a mano, no hay ningún dato raíz que consultar), se usa directo como input para sustituir en asunto/cuerpo — ni se resuelve ni se toca `PLACEHOLDERS_DATOS_RAIZ`. Antes de este caso (b), esta columna era estrictamente write-only |
| RESULTADO | integer, nullable — `null`=no intentado, `0`=éxito, otro=error (mismo criterio que `ACCIONES_EXTERNAS_COLA`) |
| RESULTADO_DESC | string, nullable — lo arma el componente (para SMTP, algo como `"Enviado a x@y.com."` o el mensaje de error) |
| RESULTADO_FECHA | timestamp, nullable |
| REINTENTO | integer, default 0 — se incrementa EN LA MISMA fila (no se crea una fila nueva por reintento) |
| REINTENTOS_SUPERADOS | boolean, default false |
| FECHA_ENCOLADO | timestamp, `DEFAULT now()` |

`REINTENTOS_MAX`/`REINTENTOS_MARGEN` no están acá — se heredan de la `ACCIONES_EXTERNAS` asociada (misma fila para todos los mensajes de ese proveedor).

### MENSAJERIA_COLA_ADJUNTOS

Join simple: `ID_MENSAJERIA_COLA` FK → `MENSAJERIA_COLA`, `ID_ARCHIVO_ADJUNTO` FK → `ARCHIVOS_ADJUNTOS`. Varios adjuntos por mensaje.

### SP_MENSAJERIA_ENCOLAR (`packages/db/sql/0017_sp_mensajeria_encolar_placeholders_forzar_inmediato.sql`, reemplaza a `0009`)

`PROCEDURE(p_id_mensajeria_cola, p_id_plantilla, p_id_accion_externa, p_id_entidad, p_id_registro, p_ids_adjuntos uuid[], p_datos jsonb, p_destino text, p_placeholders jsonb DEFAULT NULL, p_forzar_inmediato boolean DEFAULT false)`. El `ID` lo genera el llamador (`packages/core`, mismo criterio que `sp_gestionar_tramite` — evita parámetros `OUT` en un `CALL` desde postgres.js). Inserta `MENSAJERIA_COLA` (`DESTINO`, `PLACEHOLDERS_DATOS_RAIZ`=`p_datos`, `PLACEHOLDERS`=`p_placeholders`) + `MENSAJERIA_COLA_ADJUNTOS`, y si `ACCIONES_EXTERNAS.INMEDIATO=true` **o** `p_forzar_inmediato=true`, dispara además `ACCIONES_EXTERNAS_COLA` con `ID_ENTIDAD` = la entidad `mensajeria_cola` e `ID_REGISTRO` = el `MENSAJERIA_COLA.ID` recién creado — esa combinación es la señal de "procesá SOLO este mensaje" (ver "Modo de despacho" abajo). Con `INMEDIATO=false` y sin forzar, no dispara nada — se asume que algo más (a futuro, un `PASO` de Procesos) va a insertar esa fila más tarde, de una sola vez para varios mensajes juntos.

`p_placeholders`/`p_forzar_inmediato` los suma `0017` — los usa el modal de "Probar" de Plantillas de Mensajería (ver más abajo). `sp_encolar_mensaje_sin_commit` (`0018_sp_encolar_mensaje_sin_commit_placeholders_forzar_inmediato.sql`, reemplaza a `0016`) suma los mismos dos parámetros en paridad, aunque hoy ningún `ACCIONES.COMANDO`/`PROCESOS_PASOS.COMANDO` los use — quedan disponibles por si hace falta desde ahí. Como `CREATE OR REPLACE PROCEDURE` no reemplaza si cambia la lista de parámetros (crea un overload nuevo y deja el viejo colgado), ambos archivos hacen `DROP PROCEDURE IF EXISTS` con la firma vieja antes de recrear. Los 2 parámetros nuevos van al final con `DEFAULT`, así que los callers existentes que llaman posicionalmente con la firma vieja (`sp_notificar_titular_legajo_demo`/`sp_notificar_cliente_tramite_demo` en `seed-demo-emails.ts`) siguen funcionando sin tocarlos.

Wrapper Node: `encolarMensaje(input)` en `packages/core/src/mensajeria.ts` (acepta `placeholders`/`forzarInmediato` opcionales).

### Contrato compartido de componente (`packages/core/src/mensajeria.ts`)

Cualquier proveedor de mensajería (SMTP, a futuro SMS/WhatsApp) llama a **una única función**, `procesarComponenteMensajeria(fila, enviarUno)`, pasándole solo su propia función de envío (`EnviarUnMensaje = (mensaje, parametrosAccion) => Promise<{exito, descripcion?}>`). Todo lo demás es compartido, una sola implementación:

1. **Modo de despacho**: si `fila.ID_ENTIDAD` es la entidad `mensajeria_cola` y `fila.ID_REGISTRO` es válido → procesa SOLO ese `MENSAJERIA_COLA`. Si no → barre TODOS los mensajes elegibles (`RESULTADO` null o != 0, no superados) de esa `ACCIONES_EXTERNAS`.
2. Por cada mensaje: resuelve la plantilla (`leerArchivoCrudo` + `resolverPlaceholders`, mismo mecanismo que `GENERACIONES_DOCUMENTO`) para cuerpo Y asunto, carga los adjuntos (`MENSAJERIA_COLA_ADJUNTOS`), llama a `enviarUno(...)`.
3. Escribe el resultado en `MENSAJERIA_COLA` (`finalizarIntentoMensaje` — misma aritmética de reintento que `finalizarIntentoAccionExterna`, pero usando `REINTENTOS_MAX`/`REINTENTOS_MARGEN` de la `ACCIONES_EXTERNAS` asociada) y aplica el estímulo OK/error correspondiente.
4. Al terminar todos los mensajes de esta pasada, reporta un resultado agregado a `ACCIONES_EXTERNAS_COLA` vía `finalizarIntentoAccionExterna` (éxito solo si TODOS los mensajes de esta pasada salieron bien).

Cada proveedor solo escribe la parte que lo distingue de los demás — hoy, `enviarPorSmtp` en `packages/modules/mensajeria-smtp`.

### Componente `mensajeria_smtp` (`packages/modules/mensajeria-smtp`) — segundo módulo real

`nodemailer` sobre SMTP genérico (cualquier proveedor: Brevo, Gmail, un relay propio). Credenciales en `ACCIONES_EXTERNAS.PARAMETROS` (`{host, port, secure?, usuario, contrasena, remitente}`) — **no en `.env`**, a diferencia del resto de config de infraestructura (ADR 0013): puede haber más de un proveedor SMTP configurado a la vez, cada uno su propia fila de `ACCIONES_EXTERNAS`, no encaja en una variable global única. El destinatario sale de `MENSAJERIA_COLA.DESTINO` (antes salía de `DATOS_RAIZ.destinatario`, una convención informal por proveedor — pasó a ser una columna real de la cola porque es un dato que TODO proveedor de mensajería necesita, no algo específico de SMTP).

Seed propio del módulo (`packages/modules/mensajeria-smtp/src/seed.ts`, script `seed` del paquete): crea la fila `ACCIONES_EXTERNAS` (`CODIGO='mensajeria_smtp'`) con `PARAMETROS` tomados de `.env` si están (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_REMITENTE`) — así el secreto real nunca queda hardcodeado en el seed, pero sigue habiendo un lugar consistente (`.env` local) para que un desarrollador cargue sus propias credenciales de prueba (ej. Brevo, ver brainstorm original de este sprint). Sin esas variables, la fila se crea con `PARAMETROS=null` y no manda nada hasta que alguien las cargue.

**Cargar credenciales de prueba SIN pasar por `.env`/seed** (ej. para probar con una cuenta SMTP real en un entorno de desarrollo puntual, sin dejar el secreto commiteado en ningún lado): un `UPDATE` directo, a mano, sobre la fila existente —

```sql
UPDATE "ACCIONES_EXTERNAS"
SET "PARAMETROS" = '{"host":"...", "port":587, "secure":false, "usuario":"...", "contrasena":"...", "remitente":"..."}'::jsonb
WHERE "CODIGO" = 'mensajeria_smtp';
```

(o el mismo `UPDATE` vía Drizzle desde un script `scratch-*.ts` descartable, nunca commiteado — ver convención de scripts scratch de este proyecto). El entorno de desarrollo actual tiene cargadas así credenciales de **Resend** reales — no están en ningún seed ni archivo versionado, viven solo en la fila de la base.

Verificado en vivo con un SMTP de prueba real (Ethereal, vía `nodemailer.createTestAccount()`) — encolar → despacho casi instantáneo vía `NOTIFY` → envío real exitoso → `PLACEHOLDERS` con el mapa resuelto → `DATOS_RAIZ` intacto. También se verificó el reintento: un mensaje con un placeholder roto falló, quedó elegible, y en la siguiente pasada del barrido (tras arreglar el placeholder) se reintentó y mandó bien — `REINTENTO` incrementado en la misma fila de `ACCIONES_EXTERNAS_COLA`, sin fila nueva.

Se probó primero con Brevo real: dos rechazos consecutivos, ninguno relacionado con este código (`525 Unauthorized IP address`, después de autorizar la IP `502 Your SMTP account is not yet activated` — la cuenta en sí nunca llegó a activarse). Se cambió a **Resend** (`host: smtp.resend.com`, `port: 465`, `secure: true`, `usuario: 'resend'`, `contrasena: <API key>`, `remitente: 'onboarding@resend.dev'` — su dirección de sandbox, sin verificación de dominio, solo entrega a la casilla del dueño de la cuenta) — mismo mecanismo genérico SMTP, sin cambiar una línea de código del módulo, y **envío real exitoso confirmado** (`RESULTADO=0`, mail recibido). Prueba de que `mensajeria_smtp` es efectivamente agnóstico de proveedor: cambiar de Brevo a Resend fue estrictamente un cambio de datos en `PARAMETROS`.

### EMAILS — casillas de un cliente (core, no depende de ningún módulo de mensajería)

`EMAILS` (`ID`, `EMAIL`, `PRINCIPAL` boolean, `ID_CLIENTE` FK → `CLIENTES`, `COMODIN` jsonb, `ALTA_FECHA`/`ALTA_USUARIO`/`AUDIT_FECHA`/`AUDIT_USUARIO`) vive en `packages/core/src/emails.ts`, calcado de `clientes.ts` — los 4 campos de auditoría se completan solo desde el server action (`idUsuarioAudit`), nunca son parte del input editable desde el form. `PRINCIPAL` sigue la misma lógica que `CLIENTES.ES_TITULAR` sobre `ID_LEGAJO`: a lo sumo un `PRINCIPAL=true` por `ID_CLIENTE`, auto-swap vía trigger (`packages/db/sql/0010_trigger_emails_principal.sql`, mismo patrón que `0001_trigger_clientes_titular.sql`), no un bloqueo duro.

ABM propio embebido en el modal de Legajo, dentro de la herramienta de Clientes (`LEGAJO_CLI_1`) — un botón "Emails" en el panel de detalle del cliente seleccionado abre `EmailsClienteDialog` (`apps/web/src/components/emails-cliente-dialog.tsx`), que lista/agrega/borra emails y permite marcar uno como principal. No es un módulo aparte ni depende de `mensajeria-smtp` — es dato de dominio de `CLIENTES`, el módulo de mensajería solo lo CONSUME (vía la acción que arma `DESTINO`).

### Disparar mensajería desde una transición del motor de estados

Una `ACCION` (motor de estados, ver `domain/motor-de-estados.md`) puede necesitar armar y encolar un mensaje al aplicarse una transición — ej. "al resolver un trámite de cliente, mandale un mail con su email principal". Acá aparece una restricción real de Postgres que vale la pena dejar documentada: `sp_aplicar_estimulo` corre `ACCIONES.COMANDO` vía `EXECUTE ... USING` (SQL dinámico) — y una llamada, desde ese contexto dinámico, a un `PROCEDURE` que hace `COMMIT` internamente (como `SP_MENSAJERIA_ENCOLAR`) **siempre falla** con `invalid transaction termination`, sea el wrapper una `FUNCTION` o un `PROCEDURE` — el problema no es la anidación de procedimientos en sí, es que `EXECUTE` dinámico corre por SPI, y SPI no admite control transaccional en la cadena, punto. La solución es que la `ACCION` NO llame a `SP_MENSAJERIA_ENCOLAR` directo — usa `sp_encolar_mensaje_sin_commit` (`packages/db/sql/0016_sp_encolar_mensaje_sin_commit.sql`, infra real, no demo) en su lugar, que hace el mismo `INSERT` sin los `COMMIT` (no hacen falta ahí: todo confirma junto con la transacción del `CALL` de más afuera, sea `sp_aplicar_estimulo` o `sp_ejecutar_un_proceso_pendiente` de Procesos — ver `domain/procesos.md`).

Separado: Postgres tampoco permite subqueries como argumento de un `CALL` (`cannot use subquery in CALL argument`) — cualquier valor que necesite un `SELECT` (plantilla, acción externa, entidad, destino) hay que resolverlo primero en una variable `DECLARE`/`SELECT ... INTO`, nunca inline en la llamada. Por eso cada `ACCION` que dispara un mensaje necesita su propio `PROCEDURE` "resolutor" (ej. `sp_notificar_titular_legajo_demo`/`sp_notificar_cliente_tramite_demo` en `packages/core/src/seed-demo-emails.ts`) que arma `p_id_registro`/`p_destino`/etc. en variables ANTES de llamar a `sp_encolar_mensaje_sin_commit` — ambos demo-only (siguen el criterio de `fn_filtro_tramite_cli_titular_1`: exclusivos del seed que los crea, no viven en `packages/db/sql/`).

**Datos de prueba** (`packages/core/src/seed-demo-emails.ts`, script `db:seed:demo:emails`, depende de `seed-demo.ts`): 8 `PLACEHOLDERS` de prueba en dos conjuntos — `TRA_LEGAJO_*` (parten de un trámite sobre `LEGAJOS`: número, estado, titular, fecha de alta) y `TRA_CLIENTE_*` (parten de un trámite sobre `CLIENTES`: nombre, documento, y también datos del legajo asociado vía `CLIENTES.ID_LEGAJO`) — 4 `MENSAJERIA_PLANTILLAS` (2 por conjunto, usando todos los tags) — y 2 `TIPOS_TRAMITE` nuevos (`TEST_MSG_LEGAJO_1`/`TEST_MSG_CLIENTE_1`), cada uno con su propia `ESTRATEGIA` aislada (un solo estado "activo" con 2 self-loops) para no compartir transición con `STD_TRAMITE_1` ni entre sí — 2 estímulos por estrategia, cada uno dispara una de las 2 plantillas de su conjunto. Verificado en vivo: los 4 mensajes se encolaron, resolvieron placeholders correctamente, y se enviaron de verdad.

### Probar una plantilla (`MensajeriaPlantillaProbarDialog`)

Botón (ícono matraz, `FlaskConical`) al lado de editar/borrar en cada fila de `/dashboard/mensajeria-plantillas`. Abre un modal para mandar un envío real de esa plantilla sin necesitar una entidad/registro/evento del motor de estados de verdad:

1. Al abrir, calcula los códigos `##CODIGO##` que usa la plantilla (`extraerPlaceholdersDePlantilla`, `packages/core/src/mensajeria-plantillas.ts`) — junta `ASUNTO` + el HTML del archivo modelo (`leerArchivoCrudo`) y les pasa `extraerCodigosPlaceholders` (`packages/core/src/placeholders.ts`), la MISMA función que usa `resolverPlaceholders` por dentro, pero sin resolver nada contra la tabla `PLACEHOLDERS` — no hace falta, es solo para saber qué campos pedirle a la persona que está probando.
2. El formulario pide: Email destino, un campo de texto por cada código detectado, un combo con las `ACCIONES_EXTERNAS` habilitadas para mensajería (`listAccionesExternasMensajeria` — `MENSAJERIA=true AND ACTIVO=true`), y un checklist de adjuntos.
3. **Adjuntos — reusa documentos ya existentes, no sube archivos nuevos**: el checklist lista todas las `PLANTILLAS_ADJUNTOS` con archivo cargado (`listPlantillasAdjuntoParaProbarAction`). Se descartó deliberadamente dejar subir un archivo nuevo desde el modal — en una instalación real, un archivo cargado solo para una prueba puntual quedaría como basura en `ARCHIVOS_ADJUNTOS` para siempre (limpiarlo automáticamente post-envío es fràgil: si esa limpieza falla, el archivo queda huérfano de por vida). Al enviar, `resolverArchivosDePlantillas` (`packages/core/src/plantillas-adjunto.ts`) resuelve los `PLANTILLAS_ADJUNTOS.ID` elegidos a sus `ARCHIVOS_ADJUNTOS.ID` y los pasa como `idsAdjuntos` a `encolarMensaje` — mismo mecanismo que ya usa cualquier mensaje real, sin tocar el schema ni las SPs. Los documentos se adjuntan tal cual, sin resolver sus propios placeholders.
4. Al enviar (`enviarMensajePruebaAction`): llama a `encolarMensaje` con `idEntidad`/`idRegistro` en `null` (no hay entidad real detrás), `placeholders` = el mapa que completó la persona, y `forzarInmediato: true` — así dispara ya mismo sin importar el `INMEDIATO` configurado en la `ACCIONES_EXTERNAS` elegida. Al procesarlo, `procesarUnMensaje` detecta que `MENSAJERIA_COLA.PLACEHOLDERS` ya vino poblado y usa `sustituirPlaceholdersDesdeMapa` en vez de `resolverPlaceholders` — no corre ninguna query de la tabla `PLACEHOLDERS`.
5. El modal no se cierra mientras dura el envío (`onOpenChange` bloqueado) — muestra "Enviando el mensaje, por favor espere en esta pantalla." y el botón de enviar se reemplaza por un spinner con tooltip "Enviando..". Como no hay WebSockets/SSE en este repo, el tracking es polling: cada ~2.5s llama a `getEstadoMensajePruebaAction(id)` (`getEstadoMensaje`, trae `RESULTADO`/`RESULTADO_DESC`/`REINTENTOS_SUPERADOS` de esa fila puntual de `MENSAJERIA_COLA`) hasta que `RESULTADO=0` (éxito) o `REINTENTOS_SUPERADOS=true` (falló y ya no va a reintentar más) — recién ahí corta el polling, muestra el resultado, y rehabilita el botón. Mismo patrón de polling que ya usa `ProcesosTool` (ahí es `router.refresh()` cada 3s para toda la pantalla; acá es un `setInterval` propio del modal, sin refrescar nada más).

### Reporte "Mensajería"

Reusa el motor de Reportes igual que "Cotizaciones" — cero código nuevo salvo un tipo de columna nuevo (`tipo: "adjuntos"`, ver más abajo). Columnas: Plantilla, Resultado (`badge`, con `CASE` en la query para texto legible: Pendiente/Éxito/Error), Detalle (`RESULTADO_DESC`), Fecha, Adjuntos. Filtros: Plantilla de Mensajería (`select`) y Fecha de Encolado (`fecha_rango`). Seed en `packages/core/src/seed-config.ts` (genérico, no específico de ningún proveedor).

**Columna "adjuntos" (nueva en el motor de Reportes, ADR 0014 ya preveía que el vocabulario de tipos iba a crecer)**: el valor de la columna es el `ID` de la fila dueña de los adjuntos (acá, `MENSAJERIA_COLA.ID`, aliaseado dos veces en la query — una vez como `id` para la key de React, otra como `adjuntos_id` para esta columna puntual). `formatearValor` (`apps/web/src/lib/resultados-formato.tsx`) renderiza un botón ícono-only que dispara un callback `onVerAdjuntos`, manejado por `ReportesTool`, que abre `MensajeriaColaAdjuntosDialog` — **estrictamente de solo lectura** (lista nombre + link de descarga, nada de cargar/reemplazar/borrar), a diferencia de `ArchivoAdjuntoDialog`.

### ABM "Acciones Externas" (`/dashboard/acciones-externas`)

CRUD estándar sobre `ACCIONES_EXTERNAS` (`packages/core/src/acciones-externas-admin.ts`, calcado del ABM de Monedas) — `CODIGO`/`NOMBRE`/`COMPONENTE` (texto libre, tiene que coincidir con el nombre exacto con el que un módulo se registra vía `registrarHandlerAccionExterna`), `ACTIVO`/`INMEDIATO` (switches), `REINTENTOS_MAX`/`REINTENTOS_MARGEN` (numéricos), `PARAMETROS` (textarea JSON libre — acá es donde un admin carga credenciales de un proveedor real, ej. SMTP, sin pasar por `.env` ni por un script; **queda visible en texto plano para cualquiera con acceso a esta herramienta**, coherente con que el diseño original ya asumía que `PARAMETROS` vive en la base, no en un secreto manager). `TOKEN`/`TOKEN_EXPIRACION` no son editables desde acá — reservados para un `COMPONENTE` futuro basado en OAuth que los administre él mismo. Borrado bloqueado si hay filas de `ACCIONES_EXTERNAS_COLA` o `MENSAJERIA_COLA` que la referencian.

### Reporte "Acciones Externas"

Reusa el motor de Reportes, mismo patrón que "Cotizaciones"/"Mensajería". Columnas: Acción, Resultado (`badge`), Detalle, Reintento, Tiempo (ms), Fecha (`tipo: "fecha_hora"`, ver abajo). Filtros: Acción Externa (`select`) y Fecha de Encolado (`fecha_rango`).

**Columna `tipo: "fecha_hora"` (nueva en el motor de Reportes)**: `formatearValor` la muestra con hora y minutos (`toLocaleString`), a diferencia de `tipo: "fecha"` (solo fecha, `toLocaleDateString`) — se agregó como tipo aparte en vez de cambiar el comportamiento de `"fecha"` para no afectar a los reportes que ya la usan (Auditoría de Generaciones, Bandejas de legajos/cuentas). "Cotizaciones" también pasó a usar `"fecha_hora"` — con varias cotizaciones consultadas el mismo día, la hora es el dato que distingue una de otra.

### Disparar acciones externas / mensajes desde SQL de confianza sin COMMIT (`ACCIONES.COMANDO`, `PROCESOS_PASOS.COMANDO`)

`sp_encolar_mensaje_sin_commit` (`packages/db/sql/0016_sp_encolar_mensaje_sin_commit.sql`) es la versión de `SP_MENSAJERIA_ENCOLAR` pensada para este caso — mismo `INSERT` en `MENSAJERIA_COLA`/`ACCIONES_EXTERNAS_COLA`, sin los `COMMIT` internos (no hacen falta: comitea junto con la transacción del `CALL` que la dispara desde más afuera). Cualquier `ACCION`/`PASO` que necesite encolar un mensaje tiene que pasar por acá, nunca por `SP_MENSAJERIA_ENCOLAR` directo — ver "Disparar mensajería desde una transición del motor de estados" más abajo para el porqué.

Ejemplo real: `envio_mensajes_pendientes` (proceso, `packages/core/src/seed-config.ts`) — barre `MENSAJERIA_COLA` agrupando por `ID_ACCION_EXTERNA` y encola UN disparo por acción (no uno por mensaje) en `ACCIONES_EXTERNAS_COLA`, sin `ID_ENTIDAD`/`ID_REGISTRO` — esa combinación es justamente la señal de "modo barrido" que `procesarComponenteMensajeria` ya sabía interpretar (ver "Modo de despacho" arriba), pero que hasta este proceso no tenía ningún caller real. Cierra el hueco que dejaba `INMEDIATO=false` (mensajes que se encolan de a uno pero se despachan en lote más tarde).

## Pendiente

- Bootstrap genérico de módulos (`registrarModulo`, `apps/<client>/src/modules.ts`) — ya hay DOS módulos reales (`cotizaciones-argentina`, `mensajeria-smtp`), ambos registrados a mano en `instrumentation-node.ts`. Sigue sin construirse el mecanismo genérico de ADR 0012 — no bloqueó a ninguno de los dos, pero con un tercero probablemente valga la pena.
- Canales de mensajería adicionales (SMS, WhatsApp) — mismo contrato compartido (`procesarComponenteMensajeria`), solo falta el `EnviarUnMensaje` de cada proveedor.
- Componente `webhook` genérico (ADR 0016 original) — todavía no se construyó, sigue siendo válido para cuando haga falta.

Ver ADR 0016 y ADR 0018 para el razonamiento completo de las decisiones de diseño.
