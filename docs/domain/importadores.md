# Dominio — Motor de importación de archivos

> **Estado: implementado** (núcleo del motor + ABM de `IMPORTADORES` + wizard genérico + primer importador real de Legajos y Clientes) — ver ADR 0021 para el razonamiento de diseño completo. Este documento describe el sistema tal como quedó, no un plan.

Motor genérico para importar datos masivos desde un archivo. Un `IMPORTADORES` describe TODO lo necesario para un caso de importación puntual (dónde buscar el archivo, qué tabla de staging usar, qué `PROCEDURE` valida/impacta), disparable de tres formas — por un `PROCESO` programado, por un botón manual en su propio ABM, o por un wizard genérico donde el usuario elige importador y archivo — todas convergiendo en el mismo mecanismo de ejecución.

## Tablas

### IMPORTADORES (catálogo)

| Campo | Tipo |
| --- | --- |
| ID | UUID, PK |
| CODIGO | string, unique |
| NOMBRE | string |
| TABLA_STAGING | text — tabla de staging propia de este importador (schema fijo, no genérico) |
| SP_NOMBRE | text — nombre de `PROCEDURE` resuelto dinámicamente por `sp_importar_ejecutar` |
| EXTENSIONES_PERMITIDAS | text — lista separada por comas (`"csv,xlsx"`) |
| RUTA_DIRECTORIO | text, nullable — mínimo para poder disparar en modo automático |
| PATRON_NOMBRE_ARCHIVO | text, nullable — patrón estilo SQL `LIKE` (`%`/`_`); null = cualquier archivo con extensión permitida |
| TABLA_HISTORICO | text, nullable — null = las filas de staging se borran sin pasar por histórico |
| DIAS_RETENCION_HISTORICO | integer, nullable — null = el histórico no se limpia nunca automáticamente |
| CARPETA_DESTINO_PROCESADOS | text, nullable — null = el archivo no se mueve al terminar |
| DISPARO_AUTOMATICO_ACTIVO | boolean |
| MODO_ERROR_AUTOMATICO | text, nullable — `'abortar'` \| `'importar_validas'`, solo aplica si el anterior es true |
| ACTIVO | boolean |

Cada importador puntual trae su PROPIA tabla de staging (mapeo de columnas fijo, definido por quien lo construye — nunca dinámico en runtime), con esta forma mínima obligatoria: `ID`, `ID_EJECUCION` (FK a `IMPORTADORES_EJECUCIONES`), `NRO_FILA` (integer, 1-based relativo a las filas de datos del archivo — nunca `ID`, que es un UUID aleatorio y no sirve para mostrar/procesar en el orden real del archivo, ver `getResultadosValidacion` y el gotcha de resolución intra-archivo más abajo), columnas del dominio, `ESTADO_VALIDACION` (`'ok'`/`'advertencia'`/`'error'`), `MENSAJE_VALIDACION`. Si el importador usa histórico, esa tabla tiene el MISMO CONJUNTO de columnas (mismos nombres) — pero no necesariamente el mismo orden físico, ver el gotcha de `sp_importar_ejecutar` más abajo, así que el motor arma la lista de columnas por nombre al mover filas, nunca `SELECT *`.
>
> **Convención para todo importador "estándar"** (los que construimos nosotros, no una regla forzada por el motor): admite `csv,xlsx,txt,tsv`, y siempre lleva `TABLA_HISTORICO` con `DIAS_RETENCION_HISTORICO=30` por defecto — el motor en sí sigue soportando ambos como opcionales (sigue siendo válido un importador sin histórico), esto es una convención de construcción, no una validación de schema.

### Convención de nombres de los 3 artefactos de un importador puntual

Cada importador real trae 3 artefactos con el mismo nombre descriptivo de raíz, para que sea evidente de un vistazo que pertenecen al mismo importador:

- Tabla de staging: `IMPORT_<descriptivo>_STG` (ej. `IMPORT_LEGAJOS_CLIENTES_STG`)
- Tabla de histórico: `IMPORT_<descriptivo>_HIST` (ej. `IMPORT_LEGAJOS_CLIENTES_HIST`)
- `PROCEDURE`: `sp_import_<descriptivo>` en inglés, no `sp_importar_<descriptivo>` (ej. `sp_import_legajos_clientes`) — coincide con el prefijo `IMPORT_` de las tablas.

El sufijo `_STG`/`_HIST` va al FINAL del nombre, no como prefijo (`IMPORT_STG_...` es incorrecto) — mismo criterio que otras tablas del proyecto donde el rol (staging/histórico) es un calificador del sustantivo, no el sustantivo en sí.

**Esta convención NO aplica** al `PROCEDURE` orquestador genérico `sp_importar_ejecutar` (`packages/db/sql/0022_...`) — es infraestructura compartida por TODOS los importadores, no uno de los 3 artefactos "por importador", así que mantiene su nombre en español.

### IMPORTADORES_EJECUCIONES (auditoría y cola a la vez — mismo rol que `PROCESOS_EJECUCIONES`)

| Campo | Tipo |
| --- | --- |
| ID | UUID, PK |
| ID_IMPORTADOR | FK → IMPORTADORES |
| ID_USUARIO_DISPARO | FK → USUARIOS, **nunca null** — el usuario `sistema` (ver abajo) para corridas sin humano presente |
| MODO_ARCHIVO | `'buscar_directorio'` (automático, por proceso o por botón del ABM) \| `'subido_manual'` (wizard) |
| ARCHIVO_NOMBRE | text, nullable |
| ESTADO | `pendiente` → `cargando` → `validando` → [`esperando_confirmacion`]* → `impactando` → `completado`, o `error`/`cancelado` — *solo existe en `MODO_ARCHIVO='subido_manual'` |
| RESUMEN_VALIDACION | jsonb — `{total, ok, advertencia, error}`, lo calcula `sp_importar_ejecutar` |
| RESUMEN_IMPACTO | jsonb, nullable — forma libre, la define el `SP` de cada importador (ej. `{altas, actualizaciones, omitidos}`) |
| ERROR | text, nullable |
| ID_ACCION_EXTERNA_COLA | FK → ACCIONES_EXTERNAS_COLA, nullable — null si el disparo fue por wizard (no pasa por la cola) |
| FECHA_INICIO / FECHA_FIN | timestamptz, nullable |

Índice único parcial `(ID_IMPORTADOR, ID_USUARIO_DISPARO) WHERE ESTADO NOT IN ('completado','error','cancelado')` — guard de concurrencia real: una ejecución activa por importador+usuario, no por importador global. Dos usuarios distintos (incluido `sistema`) pueden correr el mismo importador en simultáneo.

> **Auto-cancelación de ejecuciones abandonadas del wizard**: el wizard es puro estado de React (sin persistir `idEjecucion` en ningún lado) — si el usuario cierra la pestaña o recarga la página en el paso de validación en vez de clickear "Cancelar", la ejecución queda viva en `esperando_confirmacion` y el guard de concurrencia bloquea cualquier carga nueva del mismo importador con ese usuario, sin ninguna forma de retomarla desde la UI. Por eso `cargarArchivoWizard` (`packages/core/src/importadores.ts`), antes de crear la ejecución nueva, cancela primero cualquier ejecución activa previa de ESE usuario para ESE importador — es seguro asumir que es basura de una sesión abandonada, nunca un wizard legítimamente en curso en otra pestaña (el wizard no soporta eso). **Esto NO aplica a `dispararImportadorAutomatico`** (botón "Correr ahora"/`PROCESO`): ahí sí puede haber una corrida real en curso vía la cola de `ACCIONES_EXTERNAS_COLA`, cancelarla de prepo sería destructivo — ese camino sigue devolviendo el error amigable "Ya hay una importación de este importador en curso con tu usuario." tal cual.

## Usuario "sistema"

Sembrado en `packages/core/src/seed.ts` (`ensureUsuarioSistema`) — sin `ID_PERFIL` (cero permisos), con un hash de una contraseña aleatoria que nadie conoce. Es el `ID_USUARIO_DISPARO` de toda ejecución disparada por un `PROCESO` (sin humano presente). Una corrida disparada desde el botón del ABM de Importadores usa el usuario logueado que clickeó, no `sistema`.

## Disparo — tres caminos, un solo mecanismo de despacho

Los dos modos "automático" (por `PROCESO` o por el botón del ABM) terminan en el mismo lugar: `dispararImportadorAutomatico(idImportador, idUsuario)` (`packages/core/src/importadores.ts`) — valida el guard de concurrencia (mensaje humano; el índice único de abajo es la garantía real), crea `IMPORTADORES_EJECUCIONES` (`MODO_ARCHIVO='buscar_directorio'`) y encola en `ACCIONES_EXTERNAS_COLA` vía `encolarAccionExterna` — reusando `ACCIONES_EXTERNAS`/`ACCIONES_EXTERNAS_COLA` tal cual (ver ADR 0016/0021), sin cola ni mecanismo LISTEN/NOTIFY propio.

- **Por `PROCESO`**: cada importador que necesite corrida programada tiene su propio `PROCESOS`/`PROCESOS_PASOS` configurado aparte (cron propio) — el `COMANDO` de ese paso hace el `INSERT` equivalente directo en SQL (mismo criterio que cualquier otro paso de `PROCESOS_PASOS`), usando el usuario `sistema`.
- **Botón del ABM de Importadores** (`/dashboard/importadores`, `ImportadoresTool`): llama a `dispararImportadorAutomatico` con el usuario logueado — mismo patrón que "Correr ahora" de `ProcesosTool`, deshabilitado si el importador no tiene `RUTA_DIRECTORIO`, con polling (`router.refresh()` cada 3s) mientras haya una ejecución en curso.
- **Wizard** (`/dashboard/importar`, `ImportarWizard`): el archivo ya está en Node (subido por HTTP, `FormData`) — no pasa por la cola, usa `cargarArchivoWizard`/`confirmarImportacionWizard` directo. **Todo el flujo es sincrónico**: ambas funciones llaman al `PROCEDURE` y esperan a que termine antes de devolver — no hace falta polling (a diferencia del modo automático, que si es async porque pasa por la cola).

Una única fila de catálogo en `ACCIONES_EXTERNAS` (`CODIGO='importacion_generica'`, `COMPONENTE='importacion'`) es compartida por TODOS los importadores — lo que identifica a cuál importador/ejecución corresponde cada disparo va en `ACCIONES_EXTERNAS_COLA.PARAMETROS = { idImportadorEjecucion }`.

El handler (`registrarHandlerAccionExterna('importacion', ...)`, registrado desde `apps/web/src/instrumentation-node.ts` vía `registrarMotorImportacion()`) resuelve el archivo (`RUTA_DIRECTORIO` + `PATRON_NOMBRE_ARCHIVO` + extensión permitida, **siempre por fecha de modificación más antigua, alfabético como desempate** — regla fija, sin configuración), lo parsea, lo vuelca a staging (ver "Parsers y cargadores" abajo), llama `CALL sp_importar_ejecutar(...)`, y si terminó bien mueve el archivo a `CARPETA_DESTINO_PROCESADOS` (si está configurada).

## Orquestación SQL — `sp_importar_ejecutar` (`packages/db/sql/0022_...`)

`PROCEDURE sp_importar_ejecutar(p_id_ejecucion uuid, p_solo_validar boolean)`. Resuelve `SP_NOMBRE`/`TABLA_STAGING`/`TABLA_HISTORICO` dinámicamente, validando cada identificador contra `^[A-Za-z_][A-Za-z0-9_]*$` antes de interpolarlo en `EXECUTE format(...)` (mismo criterio que `sp_aplicar_estimulo`, `0002_...`). Secuencia: validar (`CALL <SP_NOMBRE>(id, 'validar')`) → si `p_solo_validar`, corta (`esperando_confirmacion`, camino wizard) → si no, decide seguir (wizard ya confirmó; automático respeta `MODO_ERROR_AUTOMATICO`) → impactar (`CALL <SP_NOMBRE>(id, 'impactar')`) → mover a histórico (opcional) → borrar staging (fijo) → limpiar histórico viejo (opcional, por `FECHA_FIN` de la ejecución dueña de cada fila) → `completado`.

**Gotchas reales encontrados verificando esto** (documentados en el propio archivo SQL):

- Un `COMMIT` dentro de un bloque `BEGIN...EXCEPTION...END` tira `cannot commit while a subtransaction is active` si se ejecuta ANTES de llegar al `END` (el bloque es una subtransacción mientras esté abierto) — pero SÍ vale dentro del handler `EXCEPTION` (ahí ya corrió el `ROLLBACK TO SAVEPOINT` implícito, el código corre en el contexto de la transacción de afuera). Mismo patrón ya usado en `sp_aplicar_estimulo`/`sp_ejecutar_un_proceso_pendiente`, pero fácil de pisar si no se presta atención — el `COMMIT` del camino sin error siempre va DESPUÉS del `END`, nunca dentro del bloque.
- Mover a histórico con `INSERT INTO histórico SELECT * FROM staging` asume que las dos tablas tienen el MISMO ORDEN FÍSICO de columnas, no solo el mismo conjunto — asunción falsa en la práctica: `IMPORT_LEGAJOS_CLIENTES_STG` ganó su columna `NRO_FILA` con un `ALTER TABLE ADD COLUMN` posterior a su creación (queda física al final), mientras que `IMPORT_LEGAJOS_CLIENTES_HIST` (creada de una sola vez, ya con `NRO_FILA` declarada donde corresponde en el schema) la tiene en otra posición — el `SELECT *` escribía valores en la columna equivocada, con un error de tipo confuso (`column "NRO_FILA" is of type integer but expression is of type text`) en vez de un error claro de mapeo. Se corrigió armando la lista de columnas explícita por NOMBRE (`information_schema.columns`, excluyendo `ID`) para el `INSERT`/`SELECT`, en vez de depender del orden físico.

## Parsers, plantillas y cargadores (`packages/core/src/importadores.ts`)

Dos registros en memoria, mismo patrón que `registrarHandlerAccionExterna` (nunca autodescubrimiento) — más una derivación automática que NO se registra a mano:

- `registrarParserImportador(extension, parser)` — genérico, un parser sirve para cualquier importador. Soporta `csv`, `xlsx` (SheetJS), `tsv` y `txt` (estos dos últimos tab-delimited por default — convención elegida por ser la más común en exports planos de sistemas legacy; si un importador puntual necesita otro delimitador para `.txt`, registra su propio parser para esa extensión, que pisa el default). Devuelve `string[][]` (todas las filas, incluida la de encabezado si la hay).
- `derivarPlantillaImportador(tablaStaging)` — **automática, no manual**: consulta `information_schema.columns` de la tabla de staging real en runtime, excluye las columnas base (`ID`, `ID_EJECUCION`, `NRO_FILA`, `ESTADO_VALIDACION`, `MENSAJE_VALIDACION`) y reconstruye mecánicamente cada `ColumnaImportador` (`{ encabezado, campo }`) desde el nombre de columna SNAKE_CASE (`encabezado` = en minúsculas, `campo` = camelCase, confiable porque el proyecto entero sigue esa misma convención de nombres, ver `domain/core.md`). **No existe un registro manual de plantillas** — el diseño original (`registrarPlantillaImportador`/`getPlantillaImportador`, un `Map` en memoria que cada importador tenía que poblar a mano al arrancar) se descartó explícitamente: requería recordar registrar la plantilla por separado del cargador, y quedaba desincronizada si se agregaba una columna a la tabla de staging sin acordarse de tocar el registro. Con la derivación automática, agregar una columna a la tabla de staging ya alcanza para que el archivo modelo y la detección de encabezado la reflejen, sin tocar ningún código de registro.
- `registrarCargadorImportador(codigoImportador, cargador)` — específico de cada importador: toma las filas ya parseadas y las vuelca a SU tabla de staging. Un importador "estándar" no escribe esta lógica a mano — llama `derivarPlantillaImportador` para obtener las columnas y usa el helper genérico `mapearFilasImportador(filas, columnas)`, que:
  - Detecta si la primera fila es un encabezado (matchea, case-insensitive, la mitad o más de los `encabezado` declarados) o si el archivo ya viene sin encabezado — en ese caso mapea por POSICIÓN, en el mismo orden que declara la plantilla. Sin esto, un archivo sin encabezado perdería su primera fila en silencio (se trataría como si fuera el encabezado).
  - Devuelve `{ nroFila, campos }[]`, listo para que el cargador le sume `idEjecucion` e inserte.

Los parsers se registran desde `registrarMotorImportacion()`; el cargador de cada importador puntual se registra desde su propio código (ver "Legajos y Clientes" abajo) — la plantilla nunca se registra, se deriva bajo demanda.

### Archivo modelo ("Descargar archivo modelo")

Botón "?" (tooltip) en el ABM (por fila) y en el wizard (por tarjeta de importador, paso 1) — `GET /api/importadores/[id]/modelo`, resuelve el importador y deriva su plantilla vía `getColumnasModeloImportador(idImportador)` (que a su vez llama `derivarPlantillaImportador` sobre `TABLA_STAGING`), devuelve un CSV con una sola línea (los `encabezado` derivados, separados por coma) y `Content-Disposition: attachment` — mismo patrón que `apps/web/src/app/api/reportes/[id]/export/route.ts`. Ruta aparte (no server action) porque necesita devolver un archivo, no un valor serializable. Accesible con el permiso del ABM (`importadores`) O el del wizard (`importar`) — alcanza cualquiera de los dos.

## ABM (`/dashboard/importadores`)

CRUD de `IMPORTADORES` calcado del patrón "Monedas"/catálogos XCC (`Resultado<T>`, `esViolacionUnica`, `COUNT` contra `IMPORTADORES_EJECUCIONES` antes de borrar). Permiso único `importadores` (`acceso`), entrada de menú bajo "Configuración" (es config de catálogo — se movió ahí desde "Herramientas", donde había quedado por comparación con Procesos; el wizard sí se queda en Herramientas, que es lo operativo del día a día). `CODIGO` no se edita después de creado (lo usa el registro de cargadores por código exacto). El botón "Correr ahora" queda deshabilitado si el importador no tiene `RUTA_DIRECTORIO` configurada. Columna "Estado" con badge verde (activo) / rojo (inactivo). El diálogo de alta/edición tiene `max-h-[85vh] overflow-y-auto` — con ~13 campos agrupados en secciones, desborda la altura de la ventana sin eso.

## Wizard genérico (`/dashboard/importar`)

Permiso propio `importar` (`acceso`), separado del `importadores` del ABM a propósito — alguien puede necesitar correr importaciones sin poder crear/editar/borrar la configuración de los importadores. 4 pasos, todos dentro de un único componente stateful (`ImportarWizard`), sin ruta por paso:

1. **Elegir importador** — combo/grilla de tarjetas sobre `IMPORTADORES.ACTIVO=true` (`listImportadoresParaWizard`, que no expone `TABLA_STAGING`/`SP_NOMBRE` al cliente — son detalle de implementación interno). Cada tarjeta tiene su botón "?" de archivo modelo (ver arriba).
2. **Archivo** — input nativo filtrado por `EXTENSIONES_PERMITIDAS` del importador elegido (`accept=".csv,.xlsx"`). Al confirmar, sube el archivo por `FormData` a `cargarArchivoWizardAction`, que arma el buffer y llama a `cargarArchivoWizard` (crea la ejecución, parsea, carga a staging, corre `sp_importar_ejecutar(id, p_solo_validar=true)`). Antes de crear la ejecución nueva, cancela cualquier ejecución activa PREVIA de ese mismo usuario para ese mismo importador (ver gotcha abajo) — así el guard de concurrencia nunca bloquea un reintento legítimo.
3. **Validación** — resumen de contadores (`RESUMEN_VALIDACION`) + una tabla genérica armada por **introspección de `information_schema.columns`** sobre la tabla de staging del importador (`getResultadosValidacion`, paginada de a 20 filas) — el wizard no conoce de antemano el schema de cada importador (mapeo fijo, no dinámico), así que arma la tabla en runtime en vez de necesitar código de UI específico por importador. Columnas `ESTADO_VALIDACION`/`MENSAJE_VALIDACION` se renderizan con badge/texto especial, el resto genérico. Botón "Cancelar" llama `cancelarImportacionWizard` — la forma prolija de abandonar en este paso.
4. **Resultado** — `RESUMEN_IMPACTO` si `completado`, o el mensaje de `ERROR` si no. Botón "Nueva importación" reinicia el wizard completo.

**Todo el flujo es sincrónico** (verificado): `cargarArchivoWizard`/`confirmarImportacionWizard` llaman al `PROCEDURE` y esperan a que termine antes de devolver — a diferencia del modo automático (que pasa por `ACCIONES_EXTERNAS_COLA` y es async), acá no hace falta ningún mecanismo de polling.

## Primer importador real: Legajos y Clientes (`legajos_clientes`)

`packages/db/sql/0023_sp_import_legajos_clientes.sql` + tabla de staging `IMPORT_LEGAJOS_CLIENTES_STG` + histórico `IMPORT_LEGAJOS_CLIENTES_HIST` (`packages/db/src/schema.ts`) + cargador `packages/core/src/importador-legajos-clientes.ts`. Una fila trae datos de un `LEGAJO` y/o un `CLIENTE`. Sigue la convención de importador estándar: `csv,xlsx,txt,tsv`, histórico con 30 días de retención.

**Encabezados aceptados** (derivados automáticamente por `derivarPlantillaImportador`, ver "Parsers, plantillas y cargadores" arriba — el cargador usa `mapearFilasImportador`, así que también acepta el archivo SIN encabezado, mapeando por posición en este mismo orden): `legajo_numero`, `cliente_tipo_documento_codigo`, `cliente_nro_documento`, `cliente_es_titular` (`true`/`false`/`si`/`no`/`1`/`0`), `cliente_caracter_codigo`, `cliente_apellido`, `cliente_nombre`, `cliente_genero_codigo`, `cliente_provincia_codigo`.

**LEGAJO** — se busca por `NUMERO`; si no existe se crea con el estado `ES_INICIAL` de la estrategia `STD_LEGAJO_1` (mismo criterio que `packages/core/src/seed-demo.ts`, `ensureLegajo`/`getEstadoInicial`). Si ya existe, no se toca nada más — el estado lo gobierna el motor de estados (`sp_aplicar_estimulo`), nunca un import ciego.

**CLIENTE** — se busca por `(ID_TIPO_DOCUMENTO, NRO_DOCUMENTO)`; si no existe se crea (necesita `CLIENTE_NOMBRE`, `NOT NULL` en `CLIENTES`), si existe se actualiza **solo lo que vino en el archivo** (`COALESCE` contra el valor actual — vacío/`NULL` en una columna `CLIENTE_*` nunca borra un valor ya cargado). `ES_TITULAR` usa el trigger ya existente (`0001_trigger_clientes_titular.sql`) para la unicidad por legajo, este SP no se ocupa de eso.

**Gotcha real encontrado verificando esto**: la validación de una fila que referencia un cliente NUEVO (por tipo+nro de documento) que **otra fila ANTERIOR del mismo archivo** ya va a crear, fallaba con "necesita CLIENTE_NOMBRE" — porque `validar` solo miraba `CLIENTES` (la tabla real), y ese cliente todavía no existe ahí (lo va a crear recién `impactar`, que corre después). Es un caso realista y común (titular en una fila, co-titular del mismo legajo en otra, o una fila de corrección para el mismo cliente más abajo en el archivo) — sin el fix, cualquier archivo con más de una fila para el mismo cliente rompía en la segunda aparición. Se resolvió haciendo que `validar` también busque, cuando el cliente no existe en `CLIENTES`, una fila anterior (`NRO_FILA` menor, en la MISMA ejecución) ya validada `'ok'` con el mismo tipo+nro de documento — si la encuentra, la trata como "va a existir" (no exige `CLIENTE_NOMBRE` de nuevo, y el chequeo de "ya pertenece a otro legajo" compara contra el `LEGAJO_NUMERO` de esa fila anterior en vez de contra `LEGAJOS` real). Consecuencia práctica: si un cliente aparece en más de una fila del mismo archivo, la PRIMERA aparición (por orden en el archivo) tiene que traer los datos completos si es nueva — las siguientes pueden traer solo lo que corrige/agrega.

## Verificado

Fase 0 — suite de verificación scratch (borrada tras correr, no queda en el repo) contra un importador de juguete: guard de concurrencia (mismo usuario bloqueado, usuario distinto — incluido `sistema` — permitido en paralelo), camino feliz completo (`validar`→`impactar`→histórico→borrado de staging), `MODO_ERROR_AUTOMATICO='abortar'` corta antes de impactar dejando el staging intacto para diagnóstico, y limpieza de histórico por antigüedad borra solo las filas de ejecuciones vencidas.

Fase 1 — verificado que el seed crea la herramienta/operación/entrada de menú correctamente, y CRUD completo de `IMPORTADORES` (crear, código duplicado con mensaje amigable, editar, borrar bloqueado mientras tenga ejecuciones registradas, borrar permitido sin ellas).

Fase 2 — verificado el flujo completo de datos del wizard (`listImportadoresParaWizard` → `cargarArchivoWizard` → `getResultadosValidacion` con paginación real de 26 filas → `confirmarImportacionWizard` → `RESUMEN_IMPACTO`), el guard de concurrencia bloqueando/liberando en los momentos correctos, y `cancelarImportacionWizard` liberando el guard.

Fase 3 (`legajos_clientes`) — verificado contra datos reales (con limpieza cuidadosa después, sin tocar datos de demo pre-existentes): legajo nuevo + cliente titular nuevo, mismo legajo + cliente co-titular nuevo, actualización parcial de un cliente existente (solo `APELLIDO`, confirmado que `NOMBRE`/`ES_TITULAR` no se tocaron), fila solo-legajo, y los 6 casos de error (`LEGAJO_NUMERO` vacío, tipo/nro de documento sueltos, tipo de documento desconocido, `ES_TITULAR` inválido, cliente nuevo sin nombre, cliente de otra fila del mismo archivo con legajo distinto) — cada uno con el mensaje esperado. Encontró y corrigió en el camino: el bug de orden por `ID` aleatorio (agregó `NRO_FILA`) y el gotcha de resolución intra-archivo descripto arriba.

Ronda de feedback tras probar el ABM en browser — verificado: parsers TXT/TSV (tab-delimited), `mapearFilasImportador` con y sin encabezado (detección + mapeo posicional), `getColumnasModeloImportador`, y una corrida real completa que confirmó el bug de orden físico de columnas en el movido a histórico (ver gotcha en "Orquestación SQL") con datos reales limpiados después.

**No verificado por Claude en ninguna fase**: la UI en un browser real (interacción, estilos, `<input type="file">`, el botón "?" de archivo modelo) — el usuario ya empezó a probar el ABM y encontró 4 issues reales (modal que desbordaba, ubicación de menú, faltaba TXT/TSV+histórico, faltaba archivo modelo) — todos corregidos en esta ronda, pero sin re-probar en browser todavía.

### `RUTA_DIRECTORIO` — cómo probarlo en dev, cómo funciona en producción

No hay nada mágico: es una ruta del filesystem del PROPIO SERVIDOR donde corre el proceso Node (`resolverRuta` en `importadores.ts` — si no es absoluta, se resuelve relativa a la raíz del monorepo, mismo criterio que `UPLOADS_DIR` de `archivos-adjuntos.ts`). Para probarlo en dev: crear una carpeta real (ej. `imports/legajos_clientes/entrada` desde la raíz del repo) con un archivo `.csv` adentro, y poner esa ruta relativa en el campo del ABM.

En producción es el mismo mecanismo — el archivo tiene que estar en el disco del servidor cuando el motor lo busca. Hoy eso implica: (a) un volumen persistente montado en esa ruta (mismo requisito que ya tiene `UPLOADS_DIR`, ver ADR 0011 — sin volumen persistente, un redeploy/restart borra lo que haya ahí), y (b) algún mecanismo EXTERNO a esta app que efectivamente deje el archivo ahí (una carpeta compartida por SMB/NFS montada en esa ruta, un cron del lado del cliente que haga SFTP-a-local, o alguien copiándolo a mano) — el motor de importación no trae ningún cliente SFTP/FTP propio todavía (deliberadamente pospuesto, ver ADR 0021 y la entrada de SFTP en `docs/open-issues.md`). Sin eso, `RUTA_DIRECTORIO` solo sirve para instalaciones donde alguien (humano o proceso del cliente) puede dejar el archivo directamente en el disco del servidor.

## Reporte de auditoría "Importaciones" (dos niveles)

Reporte estándar `auditoria_importaciones` (categoría `auditoria`, `/dashboard/reportes`) sobre `IMPORTADORES_EJECUCIONES` — nivel 1: todas las corridas registradas (importador, usuario, estado, modo, archivo, contadores de `RESUMEN_VALIDACION`, `RESUMEN_IMPACTO` crudo, fechas). Nivel 2 (columna `tipo:"detalle_importacion"`, botón de ícono): abre un diálogo con el detalle registro-por-registro de ESA ejecución puntual.

El motor de `REPORTES` es de un solo nivel por diseño (ver `domain/reportes.md`) — el nivel 2 no es un mecanismo genérico de "reporte hijo", es el mismo patrón ad-hoc que ya usaban `mensajeria_cola` (`tipo:"adjuntos"`) y `procesos_ejecuciones` (`tipo:"pasos"`). La diferencia con esos dos: `getDetalleEjecucionImportador` (`packages/core/src/importadores.ts`) es **genérico por introspección**, no atado a la forma fija de una tabla — reusa el mismo mecanismo de `information_schema` que `getResultadosValidacion` (wizard, paso de validación; ambos comparten el helper interno `consultarFilasEjecucion`), eligiendo `TABLA_STAGING` o `TABLA_HISTORICO` según el estado:

- `completado` con `TABLA_HISTORICO` configurada → lee de ahí (`sp_importar_ejecutar` siempre mueve las filas antes de terminar).
- `completado` SIN histórico configurado → no hay nada que mostrar (`sp_importar_ejecutar` borra el staging al terminar, tenga o no histórico) — el diálogo muestra un mensaje, no un error.
- cualquier otro estado (`cargando`/`validando`/`esperando_confirmacion`/`impactando`/`error`/`cancelado`) → todavía tiene sus filas en `TABLA_STAGING`, nunca llegaron a moverse.

Esto significa que **cualquier importador nuevo obtiene su nivel 2 gratis** apenas se siembra en `IMPORTADORES` — no hace falta un diálogo, action ni reporte nuevo por caso.

## Dónde vive cada pieza

- Schema: `packages/db/src/schema.ts` (`importadores`, `importadoresEjecuciones`, `importLegajosClientesStg`, `importLegajosClientesHist`).
- SQL manual: `packages/db/sql/0022_sp_importar_ejecutar.sql` (motor genérico), `0023_sp_import_legajos_clientes.sql` (primer importador real) — ver su `README.md`.
- Motor + ABM + wizard + reporte (funciones de datos): `packages/core/src/importadores.ts` (incluye `getDetalleEjecucionImportador`, nivel 2 del reporte). Importador Legajos+Clientes: `packages/core/src/importador-legajos-clientes.ts`. Seed: `packages/core/src/seed.ts` (usuario `sistema`, fila de `ACCIONES_EXTERNAS`, herramientas/menú del ABM y del wizard, fila real de `IMPORTADORES` para `legajos_clientes`); `packages/core/src/seed-config.ts` (reporte `auditoria_importaciones` + sus filtros).
- UI ABM: `apps/web/src/app/dashboard/importadores/{page,actions}.tsx`, `apps/web/src/components/importadores-tool.tsx` + `importador-dialog.tsx`.
- UI wizard: `apps/web/src/app/dashboard/importar/{page,actions}.tsx`, `apps/web/src/components/importar-wizard.tsx`.
- UI reporte (nivel 2): `apps/web/src/app/dashboard/reportes/importadores-detalle-actions.ts`, `apps/web/src/components/importador-ejecucion-detalle-dialog.tsx`, wireado en `apps/web/src/lib/resultados-formato.tsx` (`tipo:"detalle_importacion"`), `reporte-resultados.tsx` y `reportes-tool.tsx`.
- Archivo modelo: `apps/web/src/app/api/importadores/[id]/modelo/route.ts`.
- Registro explícito: `apps/web/src/instrumentation-node.ts` (`registrarMotorImportacion()` + `registrarImportadorLegajosClientes()`).
