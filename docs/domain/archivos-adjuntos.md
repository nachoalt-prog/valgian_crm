# Dominio — Archivos Adjuntos

Almacenamiento genérico de archivos, asociado a cualquier cantidad de registros vía `ARCHIVOS_ADJUNTOS_ENTIDADES` (ver más abajo). El archivo real vive siempre en el filesystem de la instancia, nunca en la base — ver ADR 0011 y su addendum.

## Tablas

### TIPOS_ARCHIVOS_ADJUNTOS

| Campo             | Tipo     |
| ------------------ | -------- |
| ID                  | UUID, PK |
| CODIGO              | string   |
| NOMBRE              | string   |
| EXTENSION           | string, nullable |
| MIMETYPE            | string, nullable |
| PERMITE_CARGA       | boolean, nullable |
| PERMITE_DOWNLOAD    | boolean, nullable |
| RENDERIZAR          | boolean, nullable |

Catálogo de **formatos** (jpg, pdf, docx, etc.) — no tiene relación con la semántica de qué representa el archivo (eso no está modelado hoy; ver "Alcance" más abajo). El match contra un archivo subido es por el par exacto `(EXTENSION, MIMETYPE)`. `CODIGO` es unique.

**ABM** (`/dashboard/tipos-archivos-adjuntos`, `HERRAMIENTAS.CODIGO = 'tipos_archivos_adjuntos'`, con entrada en el menú Configuración): ABM plano, mismo patrón que Filtros — no se puede borrar un tipo si hay `ARCHIVOS_ADJUNTOS` que lo usan. `RENDERIZAR` es lo que habilita la previsualización inline en `ArchivoAdjuntoDialog` (ver más abajo) — hoy en `true` para imágenes, PDF y HTML.

### ARCHIVOS_ADJUNTOS

| Campo                  | Tipo |
| ----------------------- | ---- |
| ID                       | UUID, PK |
| ID_TIPO_ARCHIVO_ADJUNTO  | FK → TIPOS_ARCHIVOS_ADJUNTOS, nullable |
| NOMBRE_ORIGINAL          | string, nullable — el nombre que subió el usuario, solo para mostrar/descargar |
| RUTA_ARCHIVO             | string, nullable — ruta relativa dentro de `uploads/`, calculada a partir del propio `ID` |
| TAMANIO_BYTES            | integer, nullable |
| ALTA_FECHA / ALTA_USUARIO / AUDIT_FECHA / AUDIT_USUARIO | auditoría estándar |

Puramente metadata + storage del archivo — ya no sabe a qué está asociado (eso vive en `ARCHIVOS_ADJUNTOS_ENTIDADES`). El nombre real en disco es siempre `<ID>.<extensión>`, nunca `NOMBRE_ORIGINAL` (evita path traversal y colisiones).

### ARCHIVOS_ADJUNTOS_ENTIDADES

| Campo                  | Tipo |
| ----------------------- | ---- |
| ID                       | UUID, PK |
| ID_ARCHIVO_ADJUNTO       | FK → ARCHIVOS_ADJUNTOS |
| ID_ENTIDAD               | FK → ENTIDADES, nullable |
| ID_REGISTRO              | uuid, nullable — sin FK real (asociación polimórfica, mismo patrón que `TRAMITES.ID_REGISTRO`/`HISTORIAL.ID_RELACION`) |

Unique en `(ID_ARCHIVO_ADJUNTO, ID_ENTIDAD, ID_REGISTRO)` — no tiene sentido la misma asociación repetida, pero **un mismo archivo puede tener varias filas distintas** (varias asociaciones a la vez). Este es el cambio central de este sprint: antes `ID_ENTIDAD`/`ID_REGISTRO` vivían como columnas directas de `ARCHIVOS_ADJUNTOS` (1 archivo = 1 asociación); ahora son N:M. El caso real que lo motivó: un adjunto subido a un legajo puede, además, terminar asociado al movimiento de `HISTORIAL` puntual en el que se cargó (ver `domain/motor-de-estados.md`, sección "Adjuntos ↔ Historial") — el mismo archivo aparece en ambos listados sin duplicar el archivo físico ni la fila de metadata.

**Trigger `BEFORE DELETE` en `ARCHIVOS_ADJUNTOS`** (`packages/db/sql/0005_trigger_cascade_archivos_adjuntos_entidades.sql`): borra en cascada las filas de `ARCHIVOS_ADJUNTOS_ENTIDADES` del archivo — sin esto, `borrarArchivo()` fallaría por la FK (`ON DELETE NO ACTION`) apenas el archivo tuviera alguna asociación.

`guardarArchivo` sigue aceptando `idEntidad?/idRegistro?` opcionales en su input (misma firma que antes) — si vienen, crea también la primera fila de `ARCHIVOS_ADJUNTOS_ENTIDADES`, en la misma transacción que el alta del archivo. Para sumarle asociaciones adicionales a un archivo ya existente: `vincularArchivoAEntidad(idArchivoAdjunto, idEntidad, idRegistro)` (idempotente). Para consultar si un archivo tiene una asociación puntual: `tieneAsociacion(idArchivoAdjunto, idEntidad, idRegistro)` — usado por el bypass de "es mi propio avatar" (ver más abajo).

`USUARIOS.ID_ARCHIVO_ADJUNTO` (FK nullable) reemplaza al viejo `AVATAR_PATH` — la foto de perfil es un `ARCHIVOS_ADJUNTOS` más, vía la entidad polimórfica `'usuarios'` (`ID_REGISTRO` = `USUARIOS.ID`) en `ARCHIVOS_ADJUNTOS_ENTIDADES`.

## Capa de storage (`packages/core/src/archivos-adjuntos.ts`)

`UPLOADS_DIR` se resuelve relativo a la raíz del monorepo (no a `process.cwd()`, que varía entre la app Next.js y los scripts de seed), configurable con `UPLOADS_DIR` en `.env`, default `apps/web/uploads`. Los archivos quedan en `uploads/adjuntos/<1er char hex del ID>/<ID>.<extensión>` (16 buckets fijos, mismo criterio que ADR 0011).

Reglas de consistencia (no aflojar sin repensarlas):

- **Alta** (`guardarArchivo`): se genera el UUID en código, se inserta la fila (ya con su `RUTA_ARCHIVO` correcto) y **recién después** se escribe el archivo. Si la escritura falla, se borra la fila — nunca queda una fila sin archivo real detrás.
- **Toda escritura** pasa por un archivo temporal en el mismo shard y un `fs.rename` final (atómico en POSIX y en Windows) — nunca hay una ventana con contenido a medio escribir en el path real.
- **Reemplazo** (`reemplazarArchivo`): el `UPDATE` de metadata y el `rename` van dentro de la misma transacción de Drizzle — si el `rename` falla, se hace rollback del `UPDATE` y se borra el temporal; el archivo y la fila viejos quedan intactos. El `ID` nunca cambia (no hace falta actualizar FKs como `USUARIOS.ID_ARCHIVO_ADJUNTO` en cada reemplazo). Si cambió la extensión, se borra (best-effort) el archivo viejo en su path anterior.
- **Borrado** (`borrarArchivo`): se borra el archivo físico **primero**, la fila **después** — al revés que el alta. Es preferible terminar con una fila sin archivo (visible en la base, se puede reintentar) que un archivo sin fila que lo referencie (invisible, sin forma de encontrarlo).
- Validación de tipo (extensión+mimetype exacto, `PERMITE_CARGA`) siempre ocurre **server-side**, tanto en `guardarArchivo` como en `reemplazarArchivo` — nunca alcanza con ocultar un botón en el cliente.

## Acceso HTTP

- **`apps/web/src/app/api/archivos-adjuntos/`**: route handlers (no Server Actions) — subir/descargar/reemplazar/borrar mueven bytes y necesitan headers de respuesta custom, algo que Server Actions no maneja bien (límite de body chico por default, sin soporte cómodo para `Content-Disposition`).
  - `POST /api/archivos-adjuntos`: alta (`multipart/form-data`: `file`, `idEntidad`, `idRegistro`, `herramientaCodigo` opcional).
  - `GET /api/archivos-adjuntos/:id`: sirve el archivo — `Content-Disposition` con `filename="..."; filename*=UTF-8''...` (RFC 6266/5987: ASCII de respaldo + UTF-8 para nombres con tildes/espacios). Por default es `attachment` (fuerza la descarga); con `?inline=1` responde `inline`, para usar la misma URL como `src` de un `<img>`/`<embed>` de previsualización sin que el navegador dispare una descarga (con PDF, `attachment` fuerza la descarga en vez de embeber el visor — con imágenes el navegador lo ignora, pero se manda igual por consistencia).
  - `PUT /api/archivos-adjuntos/:id`: reemplazo.
  - `DELETE /api/archivos-adjuntos/:id`.
- **Autorización** (`_shared.ts`, `autorizarOperacionArchivo`): recibe `idArchivoAdjunto` (no `idEntidad`/`idRegistro` — ya no existen como columnas propias del archivo) y consulta `tieneAsociacion(idArchivoAdjunto, entidadUsuarios.id, session.usuario.id)` para el bypass de "es mi propio avatar" — un usuario siempre puede tocar un archivo así asociado sin permiso de ninguna herramienta, es una acción sobre la propia identidad. `idArchivoAdjunto` es `null` en el alta (todavía no existe el archivo; de cualquier forma el alta de avatar pasa por `actualizarAvatarAction`, no por acá). Para cualquier otro caso, el caller indica `herramientaCodigo` y una `accion` (`"acceso" | "crear" | "reemplazar" | "descargar" | "borrar"`); la función mapea `accion` a una `OPERACIONES.CODIGO` concreta y valida con `getPermisoParaOperacion` (ver `domain/infraestructura.md`, "Modelo de permisos"). Solo `LEGAJO_ADJ_1` tiene esas 5 operaciones granulares hoy — cualquier otra herramienta que reutilice este mismo endpoint (ej. `plantillas_adjuntos`) cae siempre a `OPERACION_ACCESO`, de momento. `GET` decide la `accion` según el pedido: `?inline=1` (previsualización) solo exige `acceso` — ya estás viendo un registro al que tenés acceso —, la descarga forzada (sin `?inline=1`) exige el permiso granular `descargar`. **Antes del sprint de permisos granulares, `GET` no validaba ningún permiso más allá de estar logueado** — cualquier perfil autenticado podía descargar cualquier archivo por ID adivinando/enumerando UUIDs; quedó cerrado en ese momento.
- **Foto de perfil**: excepción al patrón anterior — al ser una acción específica y de bajo volumen, se resolvió con una Server Action dedicada (`actualizarAvatarAction`, `apps/web/src/app/dashboard/avatar/actions.ts`) en vez de pasar por el route handler genérico. `next.config.ts` sube el límite de body de Server Actions a 10mb (el default de 1mb es insuficiente para fotos).

## Herramienta embebible: Archivos Adjuntos de legajo (`LEGAJO_ADJ_1`)

Solapa 6 del Layout Legajo Default (ver `domain/layouts-legajo.md`). Recibe `idLegajo`/`idEntidad`/`canGestionar` como cualquier `LEGAJO_HERRAMIENTA` (`canGestionar` acá solo importa como gate de la solapa en sí — ver más abajo). Lista todos los adjuntos asociados al legajo vía `ARCHIVOS_ADJUNTOS_ENTIDADES` (grilla con miniatura si `RENDERIZAR` + imagen, ícono genérico si no) más un botón "Nuevo".

**Primer uso real de operaciones granulares** (ver `domain/infraestructura.md`, "Modelo de permisos"): además de `acceso`, `LEGAJO_ADJ_1` tiene las operaciones `crear`, `reemplazar`, `descargar`, `guardar` y `borrar` — una por cada botón del modal de adjunto. `ArchivosAdjuntosTool` las resuelve al montar vía `getPermisosGranularesAdjuntosAction()` (`apps/web/src/app/dashboard/archivos-adjuntos/actions.ts`) y se las pasa a `ArchivoAdjuntoDialog` como props booleanas independientes (`canCrear`, `canReemplazar`, `canDescargar`, `canGuardar`, `canBorrar`) — no un único `canGestionar` como antes. El botón "Nuevo" de la grilla combina ese permiso con `PARAMETROS` (ver abajo), no usa `canGestionar` (que hoy solo gatilla si la solapa se ve).

**`PARAMETROS` (`LAYOUTS_LEGAJO_SOLAPAS.PARAMETROS`, ver `domain/infraestructura.md`, "Parámetros por punto de acceso")**: primer y único consumidor real hoy. `ArchivosAdjuntosTool` acepta las claves `crear`/`reemplazar`/`descargar`/`borrar` — `false` o `0` en cualquiera bloquea esa acción en ESTA solapa puntual, además del permiso del perfil (`efectivo = permiso && parametro`); ausente el flag o ausente `PARAMETROS` entero = sin restricción extra. Solo client-side (no hay re-chequeo server-side de `PARAMETROS`) — es config de un admin protegida por su propio ABM, no un límite de seguridad que dependa de no confiar en el cliente.

**Otros dos consumidores nuevos de `ArchivosAdjuntosTool`, sin `PARAMETROS` propio** (siempre "todo permitido" salvo lo que ya recorte el permiso del perfil sobre `LEGAJO_ADJ_1`):
- **Botón "Adjuntos" por fila en `HistorialTool`** (`apps/web/src/components/historial-adjuntos-dialog.tsx`): abre un modal chico embebiendo `ArchivosAdjuntosTool` con `idEntidad='historial'`, `idRegistro=HISTORIAL.ID` de esa fila — muestra/gestiona los adjuntos vinculados a ESE movimiento puntual (ver `domain/motor-de-estados.md`, "Adjuntos ↔ Historial"). Como `HistorialTool` es compartido, este botón aparece tanto en la solapa Historial del legajo como en la del modal de Trámites.
- **Solapa "Adjuntos" en el modal de Trámites** (`TramiteModal`, análoga a la del legajo): `idEntidad='tramites'`, `idRegistro=idTramite`. Solo visible si `idTramite` existe (no tiene sentido en un alta nueva, mismo criterio que la solapa Historial ahí).

Cada tarjeta abre la misma "ventanita" (`ArchivoAdjuntoDialog`, `apps/web/src/components/archivo-adjunto-dialog.tsx`) — mismo porte que el modal de legajo (`h-[85vh] max-w-5xl`), para que un PDF se pueda previsualizar cómodo:

- **Previsualización**: si hay un archivo recién seleccionado (todavía sin guardar), se previsualiza local (`URL.createObjectURL`) según el `mimetype` del navegador. Si es un archivo ya guardado, se previsualiza vía el route handler con `?inline=1` (ver "Acceso HTTP" arriba), solo si `TIPOS_ARCHIVOS_ADJUNTOS.RENDERIZAR` es true; si no, ícono genérico. Tres mimetypes soportados hoy: `image/*` (`<img>`), `application/pdf` (`<embed>`), `text/html` (`<iframe sandbox="">` — sandbox vacío a propósito: bloquea scripts, same-origin y forms, un HTML subido por cualquier usuario con permiso de carga es contenido no confiable).
- **Cargar / Reemplazar**: abre el selector de archivo y solo **stagea** el archivo elegido — todavía no se sube. El botón es "Cargar" (gateado por `canCrear`) si no hay archivo previo, "Reemplazar" (gateado por `canReemplazar`) si ya existía uno.
- **Guardar**: recién acá se sube de verdad (`POST` si es alta, `PUT` si ya existía), habilitado solo cuando hay un archivo stageado. Gateado por `canGuardar` **y** el `canCrear`/`canReemplazar` que corresponda según el modo — un perfil con `crear` pero sin `guardar` puede seleccionar un archivo pero no confirmarlo (permiso deliberadamente en dos capas: staging vs. commit). Si el servidor rechaza el tipo, el error se muestra en la ventanita sin tocar el archivo/fila anteriores.
- **Descargar**: habilitado solo si hay un archivo guardado, `PERMITE_DOWNLOAD` es true, **y** `canDescargar` — navega al route handler de descarga.
- **Borrar** (nuevo): solo si `canBorrar` es true y hay un archivo guardado. Pide confirmación (`ConfirmDialog`, mensaje explícito de que es irreversible) antes de llamar `DELETE`, que borra el archivo físico y la fila (`borrarArchivo`, ya existente).

`ArchivoAdjuntoDialog` es reusable más allá de esta herramienta puntual — recibe `herramientaCodigo` (qué `HERRAMIENTAS.CODIGO` valida el permiso del lado del servidor) y `idEntidad`/`idRegistro`, que pueden ser `null` para archivos globales sin registro dueño. Opcionalmente acepta `tiposPermitidos?: string[]` para restringir a ciertos `TIPOS_ARCHIVOS_ADJUNTOS.CODIGO` (restringe el `accept` del `<input type="file">` y se valida server-side en `guardarArchivo`/`reemplazarArchivo`) — usado por ejemplo en la herramienta "Plantillas de Documento" (ver `domain/generacion-documentos.md`) para admitir solo `.html`.

**`canCrear`/`canReemplazar`/`canDescargar`/`canGuardar`/`canBorrar` son props genéricas del diálogo, no operaciones hardcodeadas** — cada consumidor decide qué le pasa. Plantillas de Documento (`plantillas_adjuntos`, sin operaciones granulares todavía) le pasa el mismo booleano de `acceso` a los primeros 4 y **omite `canBorrar` a propósito**: si se permitiera borrar desde acá, se borraría `ARCHIVOS_ADJUNTOS` pero no la fila de `PLANTILLAS_ADJUNTOS` que la referencia (quedaría huérfana, con `ID_ARCHIVO_ADJUNTO` apuntando a nada) — Plantillas de Documento tiene su propio flujo de borrado en cascada (`borrarPlantillaAdjunto`, ícono de tacho en la fila de la lista), que sí borra ambas tablas en el orden correcto.

## Alcance de esta etapa (pendiente a futuro)

- `TIPOS_ARCHIVOS_ADJUNTOS` es puramente de formato — no existe hoy un concepto de "tipo de documento" (ej. "DNI frente" vs. "comprobante de domicilio") que etiquete semánticamente cada fila de `ARCHIVOS_ADJUNTOS`. Si hace falta, es una columna nueva (ej. `DESCRIPCION`) o un catálogo aparte, a definir cuando surja el caso real.
- `TRAMITES_CAMPOS_DATOS.ID_ARCHIVO_ADJUNTO` (campos de tipo `FILE` en el Modal de Trámites) tiene la FK lista pero el flujo de carga todavía no está conectado ahí — el dibujado automático de campos no incluye un caso especial para `FILE` todavía.
- `ArchivosAdjuntosTool` sigue con su prop `idLegajo` (nombre viejo) aunque ahora se reutiliza para legajos, trámites y movimientos de historial por igual — quedó así deliberadamente para no tocar `LegajoHerramientaProps` y sus 6 componentes en este mismo sprint; renombrar a algo genérico (`idRegistro`) es un cambio puramente cosmético pendiente para cuando se toque ese archivo por otra razón.
- `MENUES_OPCIONES.PARAMETROS` existe en schema y ABM (mismo mecanismo que `LAYOUTS_LEGAJO_SOLAPAS.PARAMETROS`) pero **ninguna herramienta lo interpreta todavía** — `LEGAJO_ADJ_1` no tiene entrada de menú (es embebida-solamente), así que no hay caso real que lo ejercite. Queda preparado a propósito (ver `domain/infraestructura.md`, "Parámetros por punto de acceso").
- El botón "Adjuntos" de Historial y la solapa "Adjuntos" de Trámites no tienen forma de configurar `PARAMETROS` propios (no pasan por `LAYOUTS_LEGAJO_SOLAPAS` ni por `MENUES_OPCIONES`, son agregados de UI directos) — quedan siempre "todo permitido" salvo lo que ya recorte el permiso del perfil. Si en el futuro hace falta restringirlos por punto de acceso, hay que pensar de dónde leerían ese `PARAMETROS`.
