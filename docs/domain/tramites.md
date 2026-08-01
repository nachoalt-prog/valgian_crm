# Dominio — Trámites

Formularios configurables por tipo, que se pueden iniciar y gestionar sobre cualquier registro con `ID_ENTIDAD`/`ID_RELACION` (legajos, clientes, cuentas). Cada trámite tiene su propio ciclo de vida, reutilizando el motor de estados genérico (ver `domain/motor-de-estados.md`) — un `TIPO_TRAMITE` es, en los hechos, otra `ESTRATEGIA` más.

## Tablas

### CATEGORIAS_TIPOS_TRAMITE

| Campo  | Tipo     |
| ------ | -------- |
| ID     | UUID, PK |
| CODIGO | string   |
| NOMBRE | string   |

Agrupación puramente organizativa para el desplegable "Categoría" del ABM de Trámites — no tiene efecto funcional.

### TIPOS_TRAMITE

| Campo         | Tipo                                                         |
| ------------- | ------------------------------------------------------------- |
| ID            | UUID, PK                                                       |
| CODIGO        | string                                                         |
| NOMBRE        | string                                                         |
| COMODIN       | jsonb, nullable                                                |
| ID_CATEGORIA  | FK → CATEGORIAS_TIPOS_TRAMITE, nullable                        |
| ID_ESTRATEGIA | FK → ESTRATEGIAS, nullable                                     |
| ID_ENTIDAD    | FK → ENTIDADES, nullable — a qué entidad se aplican estos trámites |
| FILTRO        | string, nullable — nombre de función SQL `fn(uuid[]) RETURNS uuid[]` |
| COMPONENTE    | string, nullable — código de componente React (ver más abajo) |

**`FILTRO`**: filtra (y puede reordenar) los candidatos del desplegable "Aplicar a" en el ABM de Trámites. Se invoca por nombre, sin comillas, igual que las funciones/procedures del motor de estados (`sp_aplicar_estimulo`, `sp_gestionar_tramite`) — no es SQL de confianza embebido como `FILTROS.QUERY`/`BANDEJAS.QUERY`, sino el nombre de un objeto ya creado en la base. Ver "Aplicar a" más abajo para el detalle de invocación.

**`COMPONENTE`**: mismo patrón que `HERRAMIENTAS`/`LEGAJO_HERRAMIENTAS` — un código estable que el frontend resuelve a un componente React, para reemplazar el dibujado automático de `TIPOS_TRAMITE_CAMPOS` por uno a medida. **No implementado todavía**: el Modal de Trámites siempre dibuja automático, sea cual sea el valor de esta columna.

### TIPOS_CAMPOS

| Campo  | Tipo     |
| ------ | -------- |
| ID     | UUID, PK |
| CODIGO | string   |
| NOMBRE | string   |

Catálogo de tipos de campo soportados por el dibujado automático del Modal de Trámites: `INPUT_TEXT`, `INPUT_DATETIME`, `INPUT_EMAIL`, `INPUT_NUMBER`, `INPUT_TEL`, `INPUT_RANGE`, `INPUT_CHECKBOX`, `INPUT_RADIO`, `FILE`, `SELECT`, `SELECT_MULTIPLE`.

### TIPOS_TRAMITE_CAMPOS

| Campo          | Tipo                                                    |
| -------------- | -------------------------------------------------------- |
| ID             | UUID, PK                                                  |
| CODIGO         | string                                                    |
| NOMBRE         | string                                                    |
| ID_TIPO_TRAMITE| FK → TIPOS_TRAMITE, nullable                              |
| ID_TIPO_CAMPO  | FK → TIPOS_CAMPOS, nullable                               |
| ORDEN          | integer, nullable                                         |
| OBLIGATORIO    | boolean, nullable                                         |
| VISIBLE        | boolean, nullable                                         |
| EDITABLE       | boolean, nullable                                         |
| LONGITUD_MAX   | integer, nullable                                         |
| NUM_MIN        | integer, nullable                                         |
| NUM_MAX        | integer, nullable                                         |
| NUM_STEP       | integer, nullable                                         |
| RADIO_GROUP    | integer, nullable — agrupa varios `INPUT_RADIO` en un único grupo excluyente |
| PLACEHOLDER    | string, nullable                                          |
| AYUDA          | string, nullable — texto de ayuda debajo del campo        |
| MASCARA        | string, nullable — **no implementado** (ver Pendiente)    |
| REGEX          | string, nullable — usado como `pattern` HTML en campos de texto |
| LISTA_VALORES  | text, nullable — SQL de confianza (ver `domain/bandejas.md` ADR 0009) que devuelve `value`/`label`, para `SELECT`/`SELECT_MULTIPLE` |

`ID_TIPO_CAMPO`/`ID_TIPO_TRAMITE_CAMPO` (abajo) son los nombres correctos de estas columnas — el pedido original las llamaba `ID_TIPO_DATO`/`TIPO_TRAMITE_CAMPO`, normalizados acá para seguir la convención `ID_<tabla>` del resto del sistema.

### TRAMITES

| Campo            | Tipo                                            |
| ---------------- | -------------------------------------------------- |
| ID               | UUID, PK                                            |
| ID_TIPO_TRAMITE  | FK → TIPOS_TRAMITE, nullable                        |
| ID_ESTADO        | FK → ESTADOS, nullable                              |
| ID_REGISTRO      | UUID, nullable — junto a `TIPOS_TRAMITE.ID_ENTIDAD` ubica el registro real |
| COMODIN          | jsonb, nullable                                     |
| ALTA_FECHA       | timestamp                                           |
| ALTA_USUARIO     | FK → USUARIOS                                       |
| AUDIT_FECHA      | timestamp                                           |
| AUDIT_USUARIO    | FK → USUARIOS                                       |
| ID_TRAMITE_PADRE | FK → TRAMITES (auto-referencial), nullable          |

`ID_ENTIDAD` no está en `TRAMITES` — se resuelve siempre indirectamente vía `ID_TIPO_TRAMITE → ID_ENTIDAD`. Esto es deliberado: el tipo de trámite ya fija a qué entidad aplica, no tiene sentido que cada instancia lo repita.

`ID_TRAMITE_PADRE` existe en el schema (para trámites jerárquicos a futuro) pero **no tiene ninguna funcionalidad wireada todavía** — ninguna pantalla lo lee ni lo escribe.

### TRAMITES_CAMPOS_DATOS

| Campo               | Tipo                                    |
| ------------------- | ------------------------------------------ |
| ID                   | UUID, PK                                   |
| ID_TRAMITE           | FK → TRAMITES, nullable                     |
| ID_TIPO_TRAMITE_CAMPO| FK → TIPOS_TRAMITE_CAMPOS, nullable         |
| VALOR_TEXTO          | text, nullable                              |
| VALOR_NUMERO         | double precision, nullable                  |
| VALOR_FECHA          | timestamp, nullable                         |
| VALOR_BOOLEANO       | boolean, nullable                           |
| ID_ARCHIVO_ADJUNTO   | uuid, nullable — sin FK (ver Pendiente)     |

Unique sobre (`ID_TRAMITE`, `ID_TIPO_TRAMITE_CAMPO`): un solo registro por campo y por trámite, habilita el `INSERT ... ON CONFLICT DO UPDATE` del merge (ver más abajo).

**Mapeo tipo de campo → columna de valor** (`packages/core/src/tramites.ts`, `mapearValorCampo`/`reconstruirValorCampo`):

| `TIPOS_CAMPOS.CODIGO` | Columna |
| --- | --- |
| `INPUT_TEXT`, `INPUT_EMAIL`, `INPUT_TEL`, `SELECT`, `INPUT_RADIO` | `VALOR_TEXTO` |
| `INPUT_NUMBER`, `INPUT_RANGE` | `VALOR_NUMERO` |
| `INPUT_DATETIME` | `VALOR_FECHA` |
| `INPUT_CHECKBOX` | `VALOR_BOOLEANO` |
| `FILE` | `ID_ARCHIVO_ADJUNTO` |
| `SELECT_MULTIPLE` | `VALOR_TEXTO`, como un array JSON serializado — caso especial: es el único tipo que necesita más de un valor en el mismo registro |

Esta resolución la hace siempre `packages/core` (client-side del SP), nunca SQL — `SP_GESTIONAR_TRAMITE` recibe los datos ya en la columna correcta y hace un upsert genérico sin conocer `TIPOS_CAMPOS`.

## "Aplicar a"

En el ABM de Trámites, tras elegir categoría y tipo de trámite, el desplegable "Aplicar a" arma sus candidatos según `TIPOS_TRAMITE.ID_ENTIDAD` (la herramienta hoy solo recibe legajos como punto de partida, ver `resolverCandidatosAplicarA` en `packages/core/src/tramites.ts`):

- **`legajos`**: un único candidato, el legajo recibido.
- **`clientes`**: todos los `CLIENTES` del legajo, ordenados por apellido y nombre — salvo que `TIPOS_TRAMITE.FILTRO` esté seteado, en cuyo caso se le pasan los IDs y se muestran (en ese orden) solo los que la función devuelve.
- **`cuentas`**: igual que clientes, pero con `CUENTAS.ID_LEGAJO`.

**Invocación de `FILTRO`**: `SELECT id FROM unnest(<filtro>(ARRAY[...])) WITH ORDINALITY AS t(id, ord) ORDER BY ord`, validando el nombre contra el mismo patrón de identificador que usa `motor-estados.ts` antes de interpolarlo. El array de UUIDs se arma explícito con `ARRAY[$1::uuid, $2::uuid, ...]` — pasar un array JS como parámetro suelto con `::uuid[]` **no funciona**: postgres.js lo serializa como una fila (`record`), no como un array literal, y Postgres tira `cannot cast type record to uuid[]`. Cualquier función nueva que reciba un array debe armarse así.

## SP_GESTIONAR_TRAMITE

Implementado en `packages/db/sql/0003_sp_gestionar_tramite.sql`, **PROCEDURE** (no función, mismo motivo que `SP_APLICAR_ESTIMULO`: necesita `COMMIT` interno).

Firma: `sp_gestionar_tramite(p_id_tramite uuid, p_id_tipo_tramite uuid, p_id_registro uuid, p_datos jsonb, p_id_estimulo uuid, p_id_usuario uuid, p_observacion text DEFAULT NULL)`.

`p_id_tramite` es un UUID plano, no un parámetro `OUT`/`INOUT` ni nullable a nivel SQL: quien llama (`gestionarTramite` en `packages/core`) decide si es un ID existente (edición) o genera uno nuevo con `crypto.randomUUID()` (alta) **antes** de llamar al procedure. Esto evita toda la complejidad de parámetros de salida en un `CALL` invocado desde postgres.js, y permite que el mismo `INSERT ... ON CONFLICT` sirva para ambos casos sin lógica `IF`.

1. Resuelve la entidad `'tramites'` en `ENTIDADES` (necesaria para el `CALL` a `sp_aplicar_estimulo` del final).
2. Valida que `p_id_tipo_tramite` exista y tenga una `ESTRATEGIA` con un estado inicial configurado.
3. **Merge contra `TRAMITES`**: `INSERT ... ON CONFLICT ("ID") DO NOTHING`. Todas las columnas que este INSERT setea (`ID_TIPO_TRAMITE`, `ID_ESTADO` con el estado inicial, `ID_REGISTRO`, `ALTA_FECHA`/`ALTA_USUARIO`) son "solo al crear" — en una edición no se toca ninguna. `ID_ESTADO`/`AUDIT_FECHA`/`AUDIT_USUARIO` los administra siempre `sp_aplicar_estimulo`, nunca este merge.
   - Esto es deliberado más allá de seguir la letra del pedido original: si se actualizara `ID_REGISTRO` en cada edición, un llamador que no conozca el valor real (ej. la bandeja genérica de Trámites, que no lo trae en su query) podría pisarlo con un valor de relleno. Con `DO NOTHING`, ese valor queda protegido para siempre después de creado.
4. **Merge contra `TRAMITES_CAMPOS_DATOS`**: un `INSERT ... ON CONFLICT ("ID_TRAMITE", "ID_TIPO_TRAMITE_CAMPO") DO UPDATE` por cada elemento de `p_datos` (vía `jsonb_to_recordset`).
5. **`COMMIT` explícito** — los datos cargados por el usuario quedan guardados incluso si el paso siguiente falla.
6. `CALL sp_aplicar_estimulo(...)` sin cambios respecto al de legajos — valida la transición, graba `HISTORIAL`, actualiza el estado y corre las `ACCIONES` configuradas.

**Validado que el `COMMIT` del paso 5 sobrevive aunque el paso 6 falle** (ej. estímulo inválido para el estado actual): se probó con procedures descartables que un `PROCEDURE` puede hacer `CALL` anidado a otro `PROCEDURE` con `COMMIT` interno sin el error `invalid transaction termination` que sí aparece al agrupar sentencias sueltas en un mismo `-c` de psql (ver `domain/motor-de-estados.md`) — esa restricción es solo para *funciones*, no para *procedures* anidados vía `CALL`.

## UI

### Modal de Trámites (`apps/web/src/components/tramite-modal.tsx`)

Componente compartido, usado tanto desde el ABM de Trámites como desde la bandeja "Trámites" (ver más abajo). Recibe `idTipoTramite`, `idRegistro`, `idUsuario` (resuelto siempre server-side desde la sesión, nunca del cliente) y **`idTramite` opcional**: si viene, carga y edita ese trámite; si no, es una alta nueva — esto último solo puede pasar desde el botón "Iniciar" del ABM. Mismo tamaño que el modal de legajo (`h-[85vh] max-w-5xl`) — hasta hace poco era más chico (`max-w-3xl`), pero le quedaba justo con las solapas Historial/Adjuntos sumadas.

- Dibuja los campos según `TIPOS_TRAMITE_CAMPOS` de ese tipo (respetando `ORDEN`, `OBLIGATORIO`, `PLACEHOLDER`, `AYUDA`, `REGEX`, `LONGITUD_MAX`, `NUM_MIN`/`MAX`/`STEP`). `TIPOS_TRAMITE.COMPONENTE` no se usa todavía (ver arriba).
- Selector de estímulo: si `idTramite` existe, parte de su `ID_ESTADO` real; si no, del estado inicial de la estrategia del tipo de trámite (`getEstimulosDisponiblesTramite` en `packages/core/src/tramites.ts`, que reusa `getEstimulosDesdeEstado` — extraído de `motor-estados.ts` para no duplicar el filtro por `PERFILES_ESTIMULOS`).
- Todo el mapeo de valores (formulario → columna de `TRAMITES_CAMPOS_DATOS` y viceversa) vive en server actions (`apps/web/src/app/dashboard/tramites/actions.ts`), nunca en el componente cliente — importar funciones de `@valgian/core` que tocan `db` desde un componente `"use client"` arrastraría el cliente de Postgres al bundle del navegador. El cliente solo maneja `{ idTipoTramiteCampo, codigoTipoCampo, valor }` crudo.
- El padre debe montarlo con una `key` que cambie según `(idTipoTramite, idRegistro, idTramite)` — arranca con estado limpio por remount en vez de resetear a mano en un efecto (mismo motivo que en `legajo-layout-modal.tsx`: `setState` síncrono al inicio de un efecto dispara el lint `react-hooks/set-state-in-effect`).
- **Solapas** (solo si `idTramite` existe — sin eso no hay historial ni adjuntos que mostrar todavía): Datos, Historial (reutiliza `HistorialTool`, el mismo componente que la solapa Historial del legajo — ver `domain/motor-de-estados.md`, "Adjuntos ↔ Historial", para el botón "Adjuntos" que aparece ahí por fila) y **Adjuntos** (reutiliza `ArchivosAdjuntosTool`, el mismo componente de la solapa `LEGAJO_ADJ_1` del legajo, con `idEntidad='tramites'`/`idRegistro=idTramite` — ver `domain/archivos-adjuntos.md`). Las tres quedan montadas simultáneamente y ocultas con CSS al cambiar de solapa, mismo criterio *keep-alive* que `legajo-layout-modal.tsx`.

### ABM de Trámites (`TRAMITES_1`, `apps/web/src/components/tramites-abm-tool.tsx`)

Herramienta embebible (sin entrada en `MENUES_OPCIONES`), configurada en la solapa 5 del Layout Legajo Default 1 (la 4 ya la ocupa Historial). Recibe `idLegajo`/`idEntidad` como cualquier herramienta de `LEGAJO_HERRAMIENTAS` — de momento solo se usa con legajos.

- Sección superior: Categoría → Tipo de Trámite → Aplicar a (en cascada) + botón "Iniciar", que abre el Modal de Trámites sin `idTramite`.
- Listado: todos los trámites del legajo, de sus clientes y de sus cuentas (`listTramitesPorLegajo`, consulta bespoke con `UNION`-like `OR` sobre las tres entidades — no pasa por el motor de Bandejas porque está acotada a un legajo puntual), ordenado por fecha de gestión descendente. Cada fila tiene un botón "Gestionar" que abre el modal con ese `idTramite`.
- Filtros (colapsables): tipo de trámite, usuario/fecha de alta, usuario/fecha de gestión. Solo se aplican al tocar "Buscar" — no son reactivos por diseño (pedido explícito).

### Bandeja "Trámites"

Reutiliza el motor de Bandejas/Filtros existente **sin ningún cambio de código** — solo datos nuevos (`FILTROS`/`BANDEJAS`/`BANDEJAS_FILTROS` en el seed de configuración). La única pieza de código nueva es la apertura polimórfica: `BANDEJAS.TIPO_APERTURA = 'tramite'` hace que `bandejas-tool.tsx` monte el Modal de Trámites (usando `tipo_tramite_id`/`registro_id`, alias que expone `BANDEJAS.QUERY`) en vez de `LegajoLayoutModal` — ver `domain/bandejas.md`.

## Pendiente

- **`COMPONENTE`**: el dibujado a medida de `TIPOS_TRAMITE_CAMPOS` vía un componente configurado no está implementado — siempre se usa el dibujado automático.
- **`MASCARA`**: columna presente en el schema, sin ninguna librería de input-masking integrada — se ignora en el Modal de Trámites.
- **Adjuntos**: `FILE`/`ID_ARCHIVO_ADJUNTO` sin tabla de archivos ni carga/guardado real (ver `open-issues.md`).
- **`ID_TRAMITE_PADRE`**: sin ninguna pantalla que lo use — trámites jerárquicos quedan para una etapa futura.
- **`CUENTAS`**: la rama "Aplicar a: Cuentas" y la bandeja de Trámites ya contemplan la entidad `cuentas`, pero como `CUENTAS` no tiene ABM ni seed de datos todavía (ver `domain/core.md`), esa rama no tiene nada que mostrar en la práctica hasta que se implemente.
