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
| ID_TRANSICION | FK → TRANSICIONES |
| ID_ENTIDAD | FK → ENTIDADES |
| ID_RELACION | UUID (fila puntual afectada) |
| OBSERVACION | text |
| ACCIONES_STATUS | integer, nullable (código de error si alguna acción falló; null = éxito) |
| ACCIONES_ERROR | string, nullable (mensaje indicando qué acción falló) |
| AUDIT_FECHA | timestamp |
| AUDIT_USUARIO | FK → USUARIOS |

`HISTORIAL` no repite `ID_ESTADO_0`/`ID_ESTIMULO`/`ID_ESTADO_1` — esa información se obtiene vía `ID_TRANSICION` → `TRANSICIONES`.

## Regla — unicidad de transición

Para una combinación (`ID_ESTRATEGIA`, `ID_ESTADO_0`, `ID_ESTIMULO`) existe como máximo una transición válida. Constraint UNIQUE sobre esas tres columnas en `TRANSICIONES`.

## Flujo de ejecución (Stored Procedure)

Toda transición se aplica a través de un SP que recibe: entidad, ID de la fila afectada, estímulo a aplicar, observación y usuario que la ejecuta.

1. Busca si existe una `TRANSICIONES` válida para el estado actual + el estímulo recibido. Si no existe, se rechaza.
2. Se confirma primero, de forma atómica:
   - Actualiza `ID_ESTADO` en la tabla afectada, junto con `AUDIT_FECHA`/`AUDIT_USUARIO`.
   - Inserta el registro correspondiente en `HISTORIAL`.
3. Después se ejecutan las acciones asociadas (vía `TRANSICIONES_ACCIONES`, en el `ORDEN` indicado), fuera de la atomicidad del paso 2:
   - Si todas se ejecutan sin error: `HISTORIAL.ACCIONES_STATUS = null`.
   - Si una falla: se corta la cadena ahí (las siguientes no se ejecutan), y se actualiza el mismo registro de `HISTORIAL` con `ACCIONES_STATUS`/`ACCIONES_ERROR`. El cambio de estado y el historial del paso 2 no se revierten.

## ACCIONES.COMANDO

Contiene código SQL ejecutable de verdad, corrido por el propio SP — no un identificador que la aplicación interpreta. La lógica completa de las estrategias vive en PL/pgSQL, no en la capa de aplicación. Ver ADR 0009.

Consecuencia: los SPs y el código de `COMANDO` requieren su propia estrategia de versionado (migraciones SQL manuales), separada de las que Drizzle genera a partir del schema TypeScript.

## Pendiente

Vínculo entre `ESTRATEGIAS` y sub-productos específicos cuando existan múltiples flujos de estado distintos para la misma entidad (ej. préstamos vs. seguros, ambos sobre `CUENTAS`). Ver `open-issues.md`.
