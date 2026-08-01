# Dominio — Generación de Documentos

Genera un PDF (ej. un contrato) a partir de un archivo modelo HTML con placeholders `##CODIGO##`, resueltos contra datos de la base, y guardado como un `ARCHIVOS_ADJUNTOS` más. Se dispara desde una ACCIÓN del motor de estados (ver `domain/motor-de-estados.md`) insertando en una tabla-cola; a futuro también desde un proceso periódico (no implementado todavía).

## Tablas

### PLACEHOLDERS

| Campo   | Tipo             |
| ------- | ---------------- |
| ID      | UUID, PK         |
| CODIGO  | string, unique   |
| NOMBRE  | string           |
| QUERY   | text, nullable   |
| ESCAPAR | boolean, nullable |
| COMODIN | jsonb, nullable  |

Sin auditoría — mismo criterio que `ACCIONES`. `QUERY` es SQL de confianza (ADR 0009): recibe un único parámetro posicional `$1` de tipo jsonb con los datos raíz del llamador (ej. `{ id_legajo, monto }`), y devuelve un valor escalar — se toma la primera columna de la primera fila. **La query tiene que castear `$1::jsonb` explícitamente**, aunque no use el valor (`SELECT ... WHERE $1::jsonb IS NOT NULL` si hace falta un placeholder "constante") — si `$1` no aparece en el texto, Postgres no puede inferir su tipo y tira error.

`ESCAPAR`: si es exactamente `false`, el resultado del placeholder NO se escapa antes de insertarlo en el HTML — permite que la propia query arme HTML de confianza (ej. una tabla). **En código se trata como `escapar !== false`** (no `=== true`): un flag en NULL queda seguro por default (escapado), nunca inseguro por default.

Sin recursión — una sola pasada, un placeholder nunca resuelve a otro `##PLACEHOLDER##`. Si hace falta componer un valor, se resuelve con SQL nativo (`CONCAT`, una función, una vista) dentro de la propia `QUERY` del placeholder.

### PLANTILLAS_ADJUNTOS

| Campo             | Tipo                            |
| ------------------ | -------------------------------- |
| ID                  | UUID, PK                         |
| ID_ARCHIVO_ADJUNTO  | FK → ARCHIVOS_ADJUNTOS, unique (1:1) |
| CODIGO              | string, unique                   |
| NOMBRE              | string                           |
| DESCRIPCION         | string, nullable                 |

Mismo patrón que `USUARIOS.ID_ARCHIVO_ADJUNTO` (ver `domain/archivos-adjuntos.md`): una tabla específica apuntando al archivo genérico, en vez de una marca/columna sobre `ARCHIVOS_ADJUNTOS`. El `ARCHIVOS_ADJUNTOS` de un modelo queda con `ID_ENTIDAD`/`ID_REGISTRO` en `NULL` — es global, se identifica por `CODIGO`, no por un registro dueño.

### GENERACIONES_DOCUMENTO (cola)

| Campo               | Tipo                                  |
| -------------------- | -------------------------------------- |
| ID                    | UUID, PK                               |
| ID_PLANTILLA          | FK → PLANTILLAS_ADJUNTOS               |
| ID_ENTIDAD            | FK → ENTIDADES (destino del PDF)       |
| ID_REGISTRO           | uuid, sin FK real (polimórfico)        |
| DATOS                 | jsonb — se le pasa a CADA placeholder como su único `$1` |
| ESTADO                | text: `pendiente` / `procesando` / `completado` / `error` |
| ID_ARCHIVO_RESULTADO  | FK → ARCHIVOS_ADJUNTOS, nullable — se completa al terminar |
| ERROR                 | text, nullable                         |
| ALTA_FECHA / AUDIT_FECHA | timestamps                          |

Un trigger `AFTER INSERT` (`packages/db/sql/0004_trigger_notify_generacion_documento.sql`) dispara `pg_notify('generaciones_documento', NEW."ID"::text)`. El payload es **solo el ID** — Postgres limita `NOTIFY` a 8000 bytes, y aunque no lo limitara, el listener siempre vuelve a consultar la tabla, nunca confía en el contenido del payload.

## Cómo se dispara

Una `ACCIONES.COMANDO` (ejecutada por `SP_APLICAR_ESTIMULO`, recibe `$1`=`ID_REGISTRO` por la convención ya establecida) hace un `INSERT` directo en `GENERACIONES_DOCUMENTO` con `ESTADO='pendiente'`. No hay puente Postgres→aplicación más allá de eso — la generación real ocurre del lado de Node.

**Ojo con `ID_ENTIDAD`/`ID_REGISTRO` del `INSERT`** — tienen que apuntar a lo que el registro que disparó la acción **ES SOBRE**, no al propio registro que disparó la transición. Ejemplo real: una acción colgada de una transición de `TRAMITES` recibe `$1`=el `ID` del propio trámite — pero casi siempre el documento generado tiene que quedar adjunto al legajo/cliente que el trámite gestiona, no al trámite en sí. El patrón correcto es resolver el destino real con un `JOIN`, no asumirlo (nota: desde que existe `ARCHIVOS_ADJUNTOS_ENTIDADES` (N:M, ver `domain/archivos-adjuntos.md`) y la solapa "Adjuntos" del Modal de Trámites, un documento SÍ podría además vincularse al trámite mismo si el caso lo pidiera — pero eso es una decisión de diseño explícita, no el comportamiento por default de este `COMANDO`):

```sql
INSERT INTO "GENERACIONES_DOCUMENTO" ("ID_PLANTILLA", "ID_ENTIDAD", "ID_REGISTRO", "DATOS", "ESTADO", "ALTA_FECHA")
SELECT
  (SELECT "ID" FROM "PLANTILLAS_ADJUNTOS" WHERE "CODIGO" = '...'),
  tt."ID_ENTIDAD",      -- de qué trata este TIPO de trámite (legajos/clientes/...)
  t."ID_REGISTRO",       -- el legajo/cliente puntual que este trámite gestiona
  jsonb_build_object('id_tramite', $1::text, 'fecha', now()::text),
  'pendiente', now()
FROM "TRAMITES" t
JOIN "TIPOS_TRAMITE" tt ON tt."ID" = t."ID_TIPO_TRAMITE"
WHERE t."ID" = $1
```

Esto se descubrió como bug real en el `COMANDO` de la acción demo: la primera versión insertaba `ID_ENTIDAD`=entidad `'tramites'` e `ID_REGISTRO`=`$1` (el propio trámite) — los documentos SE GENERABAN bien, pero quedaban archivados en una combinación que ninguna pantalla consulta, así que parecían no haberse generado nunca.

## El worker (`apps/web/src/instrumentation.ts` + `instrumentation-node.ts`)

Next.js corre en un proceso persistente y self-hosted (no serverless) — la base de todo el proyecto, no solo de esto: `ARCHIVOS_ADJUNTOS` ya asume filesystem estable (ADR 0011), y Chromium headless es un dolor conocido en serverless.

- `register()` en `instrumentation.ts` corre **una sola vez por arranque del proceso** — validado empíricamente (no en cada hot-reload de dev), lo que lo hace el lugar correcto para abrir una conexión persistente sin repetir el bug de connection-leak-por-hot-reload que ya tuvimos con el pool de Postgres (`packages/db/src/client.ts`).
- **Gotcha real de Next.js**: `instrumentation.ts` se compila para runtime `"nodejs"` Y `"edge"` a la vez, y el chequeo de `NEXT_RUNTIME` en tiempo de ejecución NO evita que el bundler intente empaquetar los imports pesados (Playwright, argon2 nativo vía `@valgian/core`) para el bundle de edge — falla en build aunque esa rama nunca fuera a correr ahí. La lógica real vive en un archivo aparte, `instrumentation-node.ts`, importado dinámicamente solo detrás del chequeo de runtime — con el import apuntando a un archivo PROPIO (no un paquete externo), Turbopack sí logra tree-shakear esa rama del bundle de edge.
- El worker mantiene una conexión `LISTEN` (vía `sql.listen()` de postgres.js — internamente maneja su propia conexión reservada, no compite con el pool normal) y reacciona casi en tiempo real. Al despertar, **drena todas** las filas pendientes (no solo una), por si se acumularon varias notificaciones seguidas.
- Se descartó `pg_net`: extensión nativa que necesita `shared_preload_libraries`, no viene en Postgres de fábrica, y muchos hostings administrados (RDS, Azure) no la permiten — rompería la portabilidad que ADR 0001 dejó explícitamente abierta.
- **Barrido de seguridad cada 15 minutos** (in-process, sin cron externo): Postgres NO reenvía notificaciones perdidas por una desconexión temporal — no es un nice-to-have, es necesario.
- El reclamo de una fila pendiente usa `SELECT ... FOR UPDATE SKIP LOCKED` en una **transacción corta** (claim + marcar `'procesando'`, commit inmediato) — el trabajo pesado (leer la plantilla, resolver placeholders, Playwright, guardar el PDF) pasa DESPUÉS, fuera de la transacción. Esto ya tolera múltiples instancias del worker sin coordinación adicional — relevante si algún día hace falta escalar horizontalmente (en ese caso el punto a resolver es el storage, filesystem → S3, no el modelo de proceso, ver ADR 0013).
- También drena pendientes **una vez al arrancar** (`drenarPendientes("arranque")`), no solo al recibir NOTIFY o en el barrido — cubre el caso de que haya quedado algo pendiente de antes del último reinicio del proceso.

**Ojo con esto al desarrollar**: `instrumentation.ts`/`instrumentation-node.ts` corren una única vez por arranque — si cambiás código en `packages/core` que el worker importa (`generacion-documentos.ts`, `placeholders.ts`, `plantillas-adjunto.ts`, `html-a-pdf.ts`) y el dev server ya estaba corriendo, el worker se queda con la versión VIEJA en memoria hasta el próximo restart completo (Next.js Fast Refresh no lo toca, a propósito — es la misma razón por la que no repite el bug de connection-leak). Un renombre de columna hecho en caliente puede dejar el worker tirando `column "X" does not exist` en cada intento silenciosamente hasta reiniciar.

## Conversión HTML → PDF

Chromium headless embebido vía Playwright (`packages/core/src/html-a-pdf.ts`) — no un servicio externo tipo Gotenberg, por portabilidad y para no sumar infraestructura nueva por cliente. Lanza y cierra el navegador por cada llamada (simplicidad; si el volumen lo justifica a futuro, se puede pasar a un browser compartido de vida más larga). Requiere el binario de Chromium instalado (`npx playwright install chromium`) como parte del setup/deploy de cada instancia — no es un servicio externo, pero sí es un paso de instalación real que hay que documentar en el checklist de deploy.

## Resolución de placeholders (`packages/core/src/placeholders.ts`)

Sin recursión (un placeholder nunca resuelve a otro `##PLACEHOLDER##`):

- Se extraen TODOS los `##CODIGO##` únicos del HTML del modelo. Cada uno que **no** tiene fila en `PLACEHOLDERS` se ignora — queda literal en el HTML final, no aborta nada. Cambió a propósito (antes cortaba toda la generación si faltaba uno): permite ir armando/pegando un template con marcadores todavía sin `PLACEHOLDERS` creado, sin que eso bloquee la generación de los demás valores.
- Los códigos que sí existen se resuelven ejecutando su `QUERY` en orden. Si una puntual falla al ejecutarse, ahí sí se corta — se informa CUÁL placeholder falló, no se sigue con los demás (esto no cambió).

## Módulos de código

`packages/core/src/`: `placeholders.ts` (resolución), `plantillas-adjunto.ts` (CRUD + lectura del HTML), `html-a-pdf.ts` (Playwright), `generacion-documentos.ts` (encolar, reclamar, procesar, y el wrapper `escucharGeneracionesPendientes` — apps/web nunca importa `@valgian/db` directo, ni siquiera `queryClient`, todo pasa por acá). Todo reutiliza `guardarArchivo`/`leerArchivoCrudo` ya existentes de `archivos-adjuntos.ts` — un documento generado es un `ARCHIVOS_ADJUNTOS` común, sin código especial.

`leerArchivoCrudo` (nueva, junto a `leerArchivoParaDescarga`): lee bytes de disco sin validar `PERMITE_DOWNLOAD` — ese flag es sobre si un usuario final puede bajarse el archivo desde la UI, no sobre si el propio sistema puede leerlo para procesar internamente (ej. el HTML de una plantilla).

## ABMs (menú Configuración)

- **Placeholders** (`placeholders`, `/dashboard/placeholders`): ABM plano de `PLACEHOLDERS` — código, nombre, query (textarea SQL) y el checkbox `ESCAPAR`. Mismo patrón que el ABM de Filtros.
- **Plantillas de Documento** (`plantillas_adjuntos`, `/dashboard/plantillas-adjuntos`): ABM de `PLANTILLAS_ADJUNTOS`. "Nueva" abre un dialog propio (código/nombre/descripción + selector de archivo, restringido a `.html`) que crea la plantilla y su archivo en un solo paso vía `crearPlantillaAdjunto`. Click en una fila existente abre el **mismo modal genérico de adjuntos** (`ArchivoAdjuntoDialog`, el mismo que usa la herramienta de adjuntos de legajo) para previsualizar/reemplazar/descargar el HTML — con el prop `tiposPermitidos={["html"]}` restringiéndolo a ese formato. Los íconos de lápiz/tacho de cada fila editan la metadata o borran la plantilla (y su archivo).

`ArchivoAdjuntoDialog` (`apps/web/src/components/archivo-adjunto-dialog.tsx`) es el componente compartido entre "Archivos Adjuntos" de legajo y "Plantillas de Documento" — recibe `herramientaCodigo` (qué `HERRAMIENTAS.CODIGO` valida el permiso del lado del servidor) y `tiposPermitidos?: string[]` (opcional, restringe qué `TIPOS_ARCHIVOS_ADJUNTOS.CODIGO` acepta, tanto en el `accept` del `<input>` como validado server-side en `guardarArchivo`/`reemplazarArchivo`). `idEntidad`/`idRegistro` aceptan `null` para archivos globales sin registro dueño.

## Datos de ejemplo (seed-demo)

4 placeholders (`demo_fecha_generacion`, `demo_asunto_tramite`, `demo_numero_legajo` con `ESCAPAR=true`, y `demo_prioridad_html` con `ESCAPAR=false` — arma un badge HTML coloreado según la prioridad del trámite), una plantilla (`demo_comprobante_1`) que los usa todos, y una `ACCIONES` (`generar_comprobante_1`) colgada de la transición "iniciado + resolver → resuelto" de `STD_TRAMITE_1` — aplicar el estímulo "Resolver" sobre un trámite tipo `TEST_LEGAJO_1` dispara la generación sola.

## Alcance de esta etapa (pendiente a futuro)

- El disparo periódico automático (mencionado en el objetivo original) no está implementado — hoy solo se dispara desde una `ACCION` del motor de estados.
- `getModalidadAlmacenamiento()` (ver ADR 0013) solo soporta `"filesystem"` — S3 queda como punto de extensión preparado, no implementado.
- Un documento generado sobre un **cliente** (ej. una acción colgada de un tipo de trámite con `ID_ENTIDAD`='clientes') queda correctamente archivado en `ARCHIVOS_ADJUNTOS`, pero hoy **no hay ninguna pantalla que lo muestre** — la única herramienta "Archivos Adjuntos" existente (`LEGAJO_ADJ_1`) es específica de legajo. Un ABM/solapa de adjuntos para clientes (y cuentas, cuando existan) es un candidato de próxima etapa.
