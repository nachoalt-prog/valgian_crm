# Dominio — Trámites

Formularios configurables por tipo, que se pueden iniciar y gestionar sobre cualquier registro con `ID_ENTIDAD`/`ID_RELACION` (legajos, clientes, cuentas). Cada trámite tiene su propio ciclo de vida, reutilizando el motor de estados genérico (ver `domain/motor-de-estados.md`) — un `TIPO_TRAMITE` es, en los hechos, otra `ESTRATEGIA` más.

## Tablas

### CATEGORIAS_TIPOS_TRAMITE

| Campo   | Tipo                                                                 |
| ------- | --------------------------------------------------------------------- |
| ID      | UUID, PK                                                               |
| CODIGO  | string                                                                 |
| NOMBRE  | string                                                                 |
| PREFIJO | string, **not null**, único — 1 a 3 letras mayúsculas (ej. `LEG`, `CLI`, `MSJ`) |

Agrupación organizativa para el desplegable "Categoría" del ABM de Trámites — ya no es *puramente* organizativa desde que `PREFIJO` antepone el número de cada `TRAMITE` de esta categoría (ver `TRAMITES.NUMERO` más abajo). `PREFIJO` es único a propósito: dos categorías con el mismo prefijo producirían números finales colisionando.

ABM propio (`/dashboard/categorias-tipos-tramite`, `HERRAMIENTAS.CODIGO = 'categorias_tipos_tramite'`, `packages/core/src/tipos-tramite.ts`: `crearCategoriaTipoTramite`/`actualizarCategoriaTipoTramite`/`borrarCategoriaTipoTramite`) — antes de esto la tabla era de solo lectura, poblada únicamente por seed. `PREFIJO` se valida (1-3 letras mayúsculas) tanto en el diálogo (auto-uppercase al tipear) como en las funciones de `packages/core` — no hay `CHECK` a nivel Postgres, mismo criterio de validación en capa de aplicación que el resto de catálogos simples de este proyecto. Borrado bloqueado si hay `TIPOS_TRAMITE` en esa categoría.

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

ABM propio (`/dashboard/tipos-tramite`, `HERRAMIENTAS.CODIGO = 'tipos_tramite'`, `packages/core/src/tipos-tramite.ts`: `crearTipoTramite`/`actualizarTipoTramite`/`borrarTipoTramite`) — antes de esto la tabla era de solo lectura, poblada únicamente por seed (`ensureTipoTramite*` en `seed-demo.ts`/`seed-config.ts`). Es un maestro-detalle: el panel izquierdo administra `TIPOS_TRAMITE`, y al seleccionar uno el panel derecho (`TipoTramiteCamposTool`) administra sus `TIPOS_TRAMITE_CAMPOS` (ver más abajo). Borrado de un tipo: bloqueado si tiene `TRAMITES`; si no tiene ninguno, cascadea sus `TIPOS_TRAMITE_CAMPOS` (y la obligatoriedad de esos campos) — sin trámites no hay datos que perder.

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

ABM propio, anidado dentro del ABM de Tipos de Trámite (`/dashboard/tipos-tramite`, ver más arriba) — no tiene ruta propia porque un campo no tiene sentido fuera del contexto de su tipo. `packages/core/src/tipos-tramite.ts`: `crearTipoTramiteCampo`/`actualizarTipoTramiteCampo`/`borrarTipoTramiteCampo`. Borrado bloqueado si el campo ya tiene datos cargados en algún `TRAMITES_CAMPOS_DATOS`.

### TIPOS_TRAMITE_CAMPOS_OBLIGATORIOS — obligatoriedad condicional por estado destino

| Campo               | Tipo                                    |
| ------------------- | ------------------------------------------ |
| ID                  | UUID, PK                                    |
| ID_TIPO_TRAMITE_CAMPO| FK → TIPOS_TRAMITE_CAMPOS, nullable        |
| ID_ESTADO           | FK → ESTADOS, nullable                      |

Reemplaza al viejo booleano `TIPOS_TRAMITE_CAMPOS.OBLIGATORIO` (fijo, sin importar el estado del trámite). Un campo es obligatorio en un momento dado si existe una fila acá para `(ese campo, el ESTADO_DESTINO de la transición que dispara el estímulo elegido)` — **no** el estado actual del trámite, sino a dónde va a parar tras aplicar el estímulo. La razón: la obligatoriedad tiene sentido validarla contra lo que el trámite está por convertirse, no contra lo que ya es (ej. un campo puede no ser obligatorio para "Tomar" un trámite pero sí para "Resolver" uno).

"Obligatorio siempre" (equivalente al viejo `OBLIGATORIO = true`) se modela marcando **todos** los estados de la estrategia del tipo — no hay un flag aparte para esto, es una decisión de diseño explícita: un solo mecanismo, sin dos fuentes de verdad compitiendo. El diálogo de edición del campo ofrece un checkbox "Todos (siempre)" como atajo de UI que selecciona todos los estados de una — no es una columna de base, solo azúcar en el formulario.

**Trade-off aceptado**: si más adelante se agrega un `ESTADO` nuevo a la estrategia, un campo marcado "siempre obligatorio" no lo va a incluir automáticamente — hay que volver a tildarlo a mano. Se prefirió esto (simple, un solo mecanismo) a agregar lógica de propagación automática.

**Validación en dos capas** (mismo patrón de defensa en profundidad que el resto de `TIPOS_TRAMITE_CAMPOS`): el Modal de Trámites (`tramite-modal.tsx`) resuelve el estado destino del estímulo elegido (ya lo trae `getEstimulosDisponiblesTramiteAction`, que expone `EstimuloDisponible.idEstadoDestino`) y valida contra `TipoTramiteCampoConTipo.obligatorioEnEstados` del lado del cliente; `gestionarTramiteAction` repite la misma resolución server-side (`resolverEstadoActualTramite` + `resolverEstadoDestino`, en `packages/core/src/tramites.ts`) antes de persistir — un llamador que se salte el cliente no puede dejar guardado un campo obligatorio vacío.

### TRAMITES

| Campo            | Tipo                                            |
| ---------------- | -------------------------------------------------- |
| ID               | UUID, PK                                            |
| ID_TIPO_TRAMITE  | FK → TIPOS_TRAMITE, nullable                        |
| ID_ESTADO        | FK → ESTADOS, nullable                              |
| ID_REGISTRO      | UUID, nullable — junto a `TIPOS_TRAMITE.ID_ENTIDAD` ubica el registro real |
| COMODIN          | jsonb, nullable                                     |
| NUMERO           | string, **not null**, único — `PREFIJO` + secuencial, lo genera un trigger (ver más abajo), nunca se arma a mano |
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

## TRAMITES.NUMERO — número legible, generado automáticamente

Trigger `BEFORE INSERT ON TRAMITES` (`fn_tramites_generar_numero`, `packages/db/sql/0019_trigger_tramites_numero.sql`) — se activa sin importar qué código dispara el `INSERT` (hoy, siempre `sp_gestionar_tramite`, paso 3 de la sección de arriba; no hace falta que ese SP sepa nada de `NUMERO`).

**Formato**: `PREFIJO` (de `CATEGORIAS_TIPOS_TRAMITE`, resuelto vía `TRAMITES.ID_TIPO_TRAMITE → TIPOS_TRAMITE.ID_CATEGORIA`) + un secuencial con padding a 6 dígitos por defecto — salvo que el número necesite más (a partir de 1000000 usa 7 dígitos, sin recortar): `lpad(v_numero::text, GREATEST(6, length(v_numero::text)), '0')`. Ej. `LEG000001`, `CLI000042`, y eventualmente `LEG1000000`.

**Concurrencia**: el secuencial por categoría se lleva en una tabla contador nueva, `TRAMITES_NUMERO_SECUENCIA (ID_CATEGORIA uuid PK → CATEGORIAS_TIPOS_TRAMITE, ULTIMO_NUMERO integer)`, incrementada con `INSERT ... ON CONFLICT ("ID_CATEGORIA") DO UPDATE SET "ULTIMO_NUMERO" = "ULTIMO_NUMERO" + 1 RETURNING "ULTIMO_NUMERO"` — una única sentencia atómica, mismo patrón `ON CONFLICT DO UPDATE` que ya usa `sp_gestionar_tramite` para `TRAMITES_CAMPOS_DATOS`. Dos altas concurrentes de la misma categoría nunca pueden leer el mismo `ULTIMO_NUMERO` (Postgres serializa a nivel de fila ahí) — no hace falta `FOR UPDATE` explícito ni una `SEQUENCE` de Postgres por prefijo. Verificado en vivo con 5 altas disparadas en paralelo (`Promise.all`) sobre la misma categoría: 5 números únicos y consecutivos, sin colisiones.

Si `TIPOS_TRAMITE.ID_CATEGORIA` es null, o esa categoría no tiene `PREFIJO` (no debería pasar — `PREFIJO` es `NOT NULL` desde que existe la columna), el trigger `RAISE EXCEPTION` — un `TIPO_TRAMITE` sin categoría con prefijo no puede tener trámites nuevos.

**Nota sobre `ON CONFLICT DO NOTHING` de `sp_gestionar_tramite`**: como el trigger es `BEFORE INSERT` (no `BEFORE INSERT ... WHEN`), Postgres lo dispara igual aunque la fila termine sin insertarse por el `DO NOTHING` (ej. al re-`gestionar` un trámite ya existente) — consume un número de la secuencia sin usarlo. Es un "hueco" cosmético en la numeración (como cualquier `SERIAL`/`IDENTITY` de Postgres frente a un rollback), no un bug — no se intentó evitar.

**Backfill**: los `TRAMITES` que ya existían antes de este mecanismo se numeraron a mano con un script scratch de una sola corrida (no versionado, no forma parte de ningún seed), en orden de `ALTA_FECHA`, usando el mismo incremento atómico contra `TRAMITES_NUMERO_SECUENCIA` — así los números backfilleados y los generados por el trigger de acá en más nunca colisionan.

## UI

### Modal de Trámites (`apps/web/src/components/tramite-modal.tsx`)

Componente compartido, usado tanto desde el ABM de Trámites como desde la bandeja "Trámites" (ver más abajo). Recibe `idTipoTramite`, `idRegistro`, `idUsuario` (resuelto siempre server-side desde la sesión, nunca del cliente) y **`idTramite` opcional**: si viene, carga y edita ese trámite; si no, es una alta nueva — esto último solo puede pasar desde el botón "Iniciar" del ABM. Mismo tamaño que el modal de legajo (`h-[85vh] max-w-5xl`) — hasta hace poco era más chico (`max-w-3xl`), pero le quedaba justo con las solapas Historial/Adjuntos sumadas.

- **Cabecera fija tipo-ticket** (simil sistemas de tickets/mesa de ayuda): franja debajo del título, visible sin importar la solapa activa (Datos/Historial/Adjuntos), con Tipo (`TIPOS_TRAMITE.NOMBRE`), Categoría (`CATEGORIAS_TIPOS_TRAMITE.NOMBRE`), Entidad (label resuelto del registro real — número de legajo, apellido+nombre de cliente, o número de cuenta, según `TIPOS_TRAMITE.ID_ENTIDAD` — mismo criterio que "Aplicar a" más abajo), N° (`TRAMITES.NUMERO`, ver más abajo — antes era el propio `ID`) y Estado (`ESTADOS.NOMBRE` actual). Tipo/Categoría/Entidad resueltos por `getCabeceraTramite` en `packages/core/src/tramites.ts`, que reusa la misma lógica de resolución de label por entidad que `resolverCandidatosAplicarA` (factorizada en `resolverLabelRegistro`). N° se resuelve aparte (`getNumeroTramiteAction` → `getTramiteDetalle(idTramite).numero`, solo si `idTramite` existe — no hay `NUMERO` hasta que el trigger lo genera al crear la fila). En alta nueva (sin `idTramite`), Tipo/Categoría/Entidad ya se conocen (vienen de las props); N°/Estado muestran "(nuevo)"/"—" hasta la primera gestión.
- Dibuja los campos según `TIPOS_TRAMITE_CAMPOS` de ese tipo (respetando `ORDEN`, `PLACEHOLDER`, `AYUDA`, `REGEX`, `LONGITUD_MAX`, `NUM_MIN`/`MAX`/`STEP`, y la obligatoriedad condicional de `TIPOS_TRAMITE_CAMPOS_OBLIGATORIOS` — ver más arriba). `TIPOS_TRAMITE.COMPONENTE` no se usa todavía (ver arriba).
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

Reutiliza el motor de Bandejas/Filtros existente **sin ningún cambio de código** — solo datos nuevos (`FILTROS`/`BANDEJAS`/`BANDEJAS_FILTROS` en el seed de configuración). La única pieza de código nueva es la apertura polimórfica: `BANDEJAS.TIPO_APERTURA = 'tramite'` hace que `bandejas-tool.tsx` monte el Modal de Trámites (usando `tipo_tramite_id`/`registro_id`, alias que expone `BANDEJAS.QUERY`) en vez de `LegajoLayoutModal` — ver `domain/bandejas.md`. Primera columna: N° (`TRAMITES.NUMERO`).

## Pendiente

- **`COMPONENTE`**: el dibujado a medida de `TIPOS_TRAMITE_CAMPOS` vía un componente configurado no está implementado — siempre se usa el dibujado automático.
- **`MASCARA`**: columna presente en el schema, sin ninguna librería de input-masking integrada — se ignora en el Modal de Trámites.
- **Adjuntos**: `FILE`/`ID_ARCHIVO_ADJUNTO` sin tabla de archivos ni carga/guardado real (ver `open-issues.md`).
- **`ID_TRAMITE_PADRE`**: sin ninguna pantalla que lo use — trámites jerárquicos quedan para una etapa futura.
- **`CUENTAS`**: la rama "Aplicar a: Cuentas" y la bandeja de Trámites ya contemplan la entidad `cuentas`, pero como `CUENTAS` no tiene ABM ni seed de datos todavía (ver `domain/core.md`), esa rama no tiene nada que mostrar en la práctica hasta que se implemente.
