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
| COMPONENTE | string — cerrado, mapea a un handler Node registrado a mano (ver "Componentes" más abajo). Hoy solo `'consulta_cotizacion'` |
| PARAMETROS | jsonb — parámetros FIJOS que el despachador le pasa al handler (credenciales, config propia del componente). Distinto de `ACCIONES_EXTERNAS_COLA.PARAMETROS` (dinámico, por llamada) |
| TOKEN | string, nullable — sesión con el servicio externo, cuando el `COMPONENTE` la necesita (mismo patrón que `USUARIOS.TOKEN`) |
| TOKEN_EXPIRACION | timestamp, nullable |
| ACTIVO | boolean — si es `false`, el barrido no reclama filas pendientes de esta acción aunque existan (pausa manual) |
| INMEDIATO | boolean — **creado, no usado todavía**: si el disparo es por evento (cada llamador encola al toque) o delegado a un proceso batch que encola una sola vez. Ningún código se ramifica según este valor por ahora |
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

## Pendiente

- Canales de mensajería (`email`, `webhook`, Telegram/WhatsApp) — sprint posterior, dependen de que este módulo ya esté andando.
- ABM/pantalla admin para `ACCIONES_EXTERNAS` — queda dev-seeded por ahora (mismo criterio que `ACCIONES.COMANDO`, ADR 0009).
- Bootstrap genérico de módulos (`registrarModulo`, `apps/<client>/src/modules.ts`) — se construye con el segundo módulo real.
- `INMEDIATO`: creado, sin ningún caller que lo interprete todavía.

Ver ADR 0016 para el razonamiento completo de las decisiones de diseño (incluida la revisión del mecanismo original).
