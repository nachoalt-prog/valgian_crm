# Dominio — Motor de estados

Mecanismo genérico y configurable para gobernar el ciclo de vida de cualquier entidad con estado. Gobierna hoy LEGAJOS y CUENTAS (ver `domain/core.md`); cualquier entidad futura con necesidad de estado puede reutilizarlo sin cambios de schema.

## Tablas

### ESTRATEGIAS

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| CODIGO | string |
| NOMBRE | string |
| ID_ENTIDAD | FK → ENTIDADES, nullable |

### ESTADOS

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_ESTRATEGIA | FK → ESTRATEGIAS |
| CODIGO | string |
| NOMBRE | string |
| ES_INICIAL | boolean |
| ES_FINAL | boolean |
| COMODIN | jsonb, nullable |

**Regla — estado inicial**: `ES_INICIAL = true` marca el estado con el que arranca cualquier entidad nueva gobernada por esa estrategia. Solo puede existir un `ESTADOS` con `ES_INICIAL = true` por `ID_ESTRATEGIA` (constraint de unicidad parcial).

**Regla — estados finales**: `ES_FINAL = true` marca un estado como desenlace terminal del flujo. A diferencia de `ES_INICIAL`, una estrategia puede tener múltiples estados con `ES_FINAL = true` (ej. "Aprobado" y "Rechazado", ambos finales para el mismo flujo) — no hay constraint de unicidad sobre esta columna.

### ESTIMULOS

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_ESTRATEGIA | FK → ESTRATEGIAS |
| CODIGO | string |
| NOMBRE | string |
| COMODIN | jsonb, nullable |

### ACCIONES

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_ESTRATEGIA | FK → ESTRATEGIAS |
| CODIGO | string |
| NOMBRE | string |
| COMANDO | text (código SQL ejecutable) |
| COMODIN | jsonb, nullable |

### TRANSICIONES

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_ESTRATEGIA | FK → ESTRATEGIAS |
| ID_ESTADO_0 | FK → ESTADOS (estado de origen) |
| ID_ESTIMULO | FK → ESTIMULOS |
| ID_ESTADO_1 | FK → ESTADOS (estado de destino) |

### TRANSICIONES_ACCIONES

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_TRANSICION | FK → TRANSICIONES |
| ID_ACCION | FK → ACCIONES |
| ORDEN | integer |

### HISTORIAL

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_ESTADO_0 | FK → ESTADOS (estado de origen al momento de aplicar) |
| ID_ESTIMULO | FK → ESTIMULOS |
| ID_ESTADO_1 | FK → ESTADOS (estado de destino resultante) |
| ID_ENTIDAD | FK → ENTIDADES |
| ID_RELACION | UUID (fila puntual afectada) |
| OBSERVACION | text |
| ACCIONES_STATUS | integer, nullable (código de error si alguna acción falló; null = éxito) |
| ACCIONES_ERROR | string, nullable (mensaje indicando qué acción falló) |
| AUDIT_FECHA | timestamp |
| AUDIT_USUARIO | FK → USUARIOS |

`HISTORIAL` graba `ID_ESTADO_0`/`ID_ESTIMULO`/`ID_ESTADO_1` directamente (no una FK a `TRANSICIONES`) — así queda registrado el camino real que se hizo, sin impedir que la transición usada se modifique o borre a futuro. Es una decisión deliberada: `TRANSICIONES` es configuración viva, `HISTORIAL` es un registro de auditoría que no debe depender de que esa configuración siga existiendo tal cual.

## Adjuntos ↔ Historial

`ENTIDADES` tiene una fila `CODIGO='historial'` — un registro de `HISTORIAL` es, para `ARCHIVOS_ADJUNTOS_ENTIDADES`, una entidad más a la que asociar archivos (`ID_ENTIDAD`=esa entidad, `ID_REGISTRO`=`HISTORIAL.ID`). Así, un mismo adjunto puede estar vinculado al legajo/trámite en general **y**, además, a un movimiento puntual — ver `domain/archivos-adjuntos.md`.

**Trigger `AFTER INSERT` en `HISTORIAL`** (`packages/db/sql/0006_trigger_historial_vincular_adjuntos.sql` + `0021_..._cuentas.sql`, `fn_vincular_adjuntos_recientes_a_historial`) auto-vincula al movimiento recién creado los adjuntos "candidatos": subidos al mismo `(ID_ENTIDAD, ID_RELACION)`, con `ARCHIVOS_ADJUNTOS.ALTA_FECHA` dentro de los últimos 10 minutos, y sin ninguna asociación previa contra la entidad `historial` (en ningún movimiento anterior, no solo este). Corre para movimientos de `legajos`, `tramites` o `cuentas` (sumada en `0021_...` para la Gestión de cuenta del módulo Cuenta Corriente) — las únicas entidades donde "un archivo recién cargado es para este movimiento" tiene sentido hoy. Agregar una entidad nueva a esta lista es un cambio de una línea en ese mismo `.sql` (`CREATE OR REPLACE`), no de la capa de aplicación.

**Heurística deliberadamente aproximada, no una garantía exacta** — casuística conocida y aceptada:
- El **primer** movimiento dentro de la ventana de 10 minutos "se lleva" el archivo — si se suben un archivo y se hacen dos transiciones seguidas en menos de 10 minutos, el archivo queda pegado a la primera, no a la segunda (por el filtro "sin asociación previa").
- Un archivo subido y luego dejado más de 10 minutos antes de gestionar el movimiento **no** se vincula solo — queda con su asociación directa al legajo/trámite nomás, sin la del movimiento puntual.

Si en algún momento esto no alcanza (ej. se necesita vincular a mano, o cambiar la ventana), el punto de entrada es ese mismo archivo SQL — no hay lógica de aplicación involucrada, el trigger corre igual sin importar si el `INSERT` en `HISTORIAL` vino de `SP_APLICAR_ESTIMULO`, de un script, o de cualquier otro lado.

### PERFILES_ESTIMULOS

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_PERFIL | FK → PERFILES |
| ID_ESTIMULO | FK → ESTIMULOS |

Unique sobre (`ID_PERFIL`, `ID_ESTIMULO`). Define qué estímulos puede aplicar cada perfil — gobierna qué opciones aparecen en el selector de la herramienta "Gestión de Entidad" (ver más abajo). Es un permiso más fino que `PERMISOS`: `PERMISOS` gobierna el acceso a la herramienta en sí (hoy, la operación `acceso` de `GESTION_ENTIDAD_1` — ver `domain/infraestructura.md`, "Modelo de permisos"), `PERFILES_ESTIMULOS` gobierna cuáles estímulos concretos puede aplicar un perfil que sí tiene acceso.

ABM en `/dashboard/perfiles-estimulos` (`HERRAMIENTAS.CODIGO = 'perfiles_estimulos'`, con entrada en el menú Configuración). En el selector de estímulos de esa pantalla, cada opción se muestra como `<estrategia> - <estímulo>` para poder distinguir estímulos del mismo nombre en estrategias distintas.

## Regla — unicidad de transición

Para una combinación (`ID_ESTRATEGIA`, `ID_ESTADO_0`, `ID_ESTIMULO`) existe como máximo una transición válida. Constraint UNIQUE sobre esas tres columnas en `TRANSICIONES`.

## Flujo de ejecución — SP_APLICAR_ESTIMULO

Implementado en `packages/db/sql/0002_sp_aplicar_estimulo.sql` como **PROCEDURE** (no función): necesita controlar sus propias transacciones internas, algo que solo un `PROCEDURE` permite en Postgres (11+), invocado vía `CALL`.

Firma: `sp_aplicar_estimulo(p_id_entidad uuid, p_id_relacion uuid, p_id_estimulo uuid, p_id_usuario uuid, p_observacion text DEFAULT NULL)`.

1. Resuelve `ENTIDADES.NOMBRE` para saber en qué tabla real vive el registro (`LEGAJOS`, `CUENTAS`, etc.) — la tabla se valida contra un patrón de identificador simple antes de usarse en SQL dinámico (`EXECUTE format(...)`), defensivo aunque `ENTIDADES` es contenido de confianza.
2. Lee el `ID_ESTADO` actual del registro (`ID_RELACION`) en esa tabla.
3. Busca la transición válida para (estado actual, estímulo) con `SELECT ... INTO STRICT` — lanza error claro si no existe ninguna o si hay más de una (inconsistencia de configuración). *(Nota: un intento anterior usaba `count(*)`/`max(...)` sobre columnas `uuid`, que falla porque Postgres no tiene `MAX(uuid)` — `INTO STRICT` es más simple y resuelve la validación de "exactamente una fila" de una.)*
4. Confirma primero, de forma atómica (con `COMMIT` explícito):
   - Actualiza `ID_ESTADO`/`AUDIT_FECHA`/`AUDIT_USUARIO` en la tabla real (SQL dinámico).
   - Inserta el registro en `HISTORIAL`.
5. Después ejecuta las acciones asociadas (`TRANSICIONES_ACCIONES`, en el `ORDEN` indicado), fuera de la atomicidad del paso 4:
   - Si todas corren sin error: `HISTORIAL.ACCIONES_STATUS` queda `null`.
   - Si una falla: se corta la cadena ahí, se actualiza el mismo registro de `HISTORIAL` con `ACCIONES_STATUS = 1` y `ACCIONES_ERROR` (el mensaje del error), y se hace `COMMIT`. El cambio de estado y el historial del paso 4 no se revierten.

**Importante para quien llama al SP**: cada `CALL sp_aplicar_estimulo(...)` debe ejecutarse como su propio statement top-level (no agrupado con otras sentencias en una misma transacción/query simple) — el `PROCEDURE` maneja sus propios `COMMIT` internos, y agruparlo con otra sentencia produce `invalid transaction termination`. `packages/core/src/motor-estados.ts` ya lo invoca así (un `db.execute` por llamada).

## ACCIONES.COMANDO

Contiene código SQL ejecutable de verdad, corrido por el propio SP — no un identificador que la aplicación interpreta. La lógica completa de las estrategias vive en PL/pgSQL, no en la capa de aplicación. Ver ADR 0009.

**Convención de parámetro**: `COMANDO` recibe un único placeholder posicional `$1` = `ID_RELACION` de la fila afectada (ej. `UPDATE "ALGO" SET "X" = 'Y' WHERE "ID_LEGAJO" = $1`). El SP lo ejecuta vía `EXECUTE v_comando USING p_id_relacion`.

Consecuencia: los SPs y el código de `COMANDO` requieren su propia estrategia de versionado (migraciones SQL manuales), separada de las que Drizzle genera a partir del schema TypeScript.

**Primer ejemplo real** (antes de esto la tabla nunca tuvo filas): la acción `generar_comprobante_1` del seed-demo, colgada de una transición de `TRAMITES`, dispara la generación de un documento — ver `domain/generacion-documentos.md`, sección "Cómo se dispara", que incluye un gotcha real encontrado ahí: cuando `$1` es el `ID` de un registro "intermedio" (como un trámite, que no es el destinatario final del efecto), el `COMANDO` tiene que resolver con un `JOIN` a qué registro real corresponde la acción — no asumir que es directamente `$1`.

## Herramienta "Gestión de Entidad"

`GESTION_ENTIDAD_1` — la herramienta que le da uso real a las estrategias. Sin entrada en `MENUES_OPCIONES` (no es navegable por sidebar): se usa embebida dentro de una solapa de `LAYOUTS_LEGAJO` (ver `domain/layouts-legajo.md`), recibiendo `ID_ENTIDAD` e `ID_RELACION` (=`idLegajo`) desde ese contexto.

- Selector de estímulos: partiendo del `ID_ESTADO` actual del registro, busca en `TRANSICIONES` todas las filas donde ese estado es `ID_ESTADO_0`, y de esas solo muestra los estímulos donde el perfil actual tiene una fila en `PERFILES_ESTIMULOS`.
- Campo de observación (textarea) + botón "Gestionar", que ejecuta `SP_APLICAR_ESTIMULO`.
- Como cualquier herramienta que todavía no migró a operaciones granulares: sin fila en `PERMISOS` para la operación `acceso`, no se ve. Con esa fila, se ve completa (no hay hoy una operación separada para deshabilitar solo el botón "Gestionar" — ver `domain/infraestructura.md`, "Modelo de permisos").

## Pendiente

Vínculo entre `ESTRATEGIAS` y sub-productos específicos cuando existan múltiples flujos de estado distintos para la misma entidad (ej. préstamos vs. seguros, ambos sobre `CUENTAS`). Ver `open-issues.md`.
