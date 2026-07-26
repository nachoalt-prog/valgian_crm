# Dominio — Layouts de Legajo

Qué pasa cuando se clickea "Abrir" sobre un resultado de una bandeja: se despliega una ventana (modal) con hasta 10 solapas configurables, cada una cargando una herramienta embebida con el legajo y el usuario actual como contexto.

## Tablas

### LAYOUTS_LEGAJO

| Campo  | Tipo     |
| ------ | -------- |
| ID     | UUID, PK |
| CODIGO | string   |
| NOMBRE | string   |

### LAYOUTS_LEGAJO_SOLAPAS

| Campo          | Tipo                                             |
| -------------- | ------------------------------------------------- |
| ID             | UUID, PK                                           |
| ID_LAYOUT      | FK → LAYOUTS_LEGAJO                                |
| ORDEN          | integer (1 a 10)                                   |
| NOMBRE         | string — label de la solapa                       |
| ID_HERRAMIENTA | FK → HERRAMIENTAS, nullable — solapa vacía si null |
| VISIBLE        | boolean                                            |

Unique sobre (`ID_LAYOUT`, `ORDEN`). Solo existen filas para las solapas configuradas — las que no tienen fila quedan ocultas y vacías por defecto (no hace falta crear 10 filas siempre).

### BANDEJAS.ID_LAYOUT

Una bandeja mapea a **un único** layout — por eso vive como columna nullable en `BANDEJAS` (`ID_LAYOUT`, FK → `LAYOUTS_LEGAJO`) y no como tabla de relación aparte. No hace falta unique adicional: al ser una sola columna, cada bandeja solo puede apuntar a un layout por definición.

## Mecanismo de herramienta embebida

Una `HERRAMIENTA` asignada a una solapa no es necesariamente una página navegable por sidebar — puede ser una herramienta que **solo** se usa embebida dentro de un layout de legajo (ej. `LEGAJO_DAT_1`, `LEGAJO_CLI_1`). El mapeo `HERRAMIENTAS.CODIGO → componente React` vive en código (`apps/web/src/lib/legajo-herramientas.ts`), mismo criterio de indirección que `lib/icons.ts` (ADR 0011): la clave es estable, el componente real puede cambiar de nombre/archivo sin tocar la base.

El componente recibe `{ idLegajo, canGestionar }` como props — el legajo sobre el que se está parado, y si el perfil actual puede editar (ver más abajo). El usuario logueado se resuelve dentro de cada action vía sesión, no se pasa como prop.

## Permisos por solapa

Cada solapa con `ID_HERRAMIENTA` asignado respeta el mismo criterio que el resto de la app: si el perfil no tiene ninguna fila en `PERMISOS` para esa herramienta, **la solapa entera queda oculta** (no aparece como botón siquiera) — no es un simple "solo lectura". Si la fila existe, `PERMISOS.GESTIONAR` habilita o no los botones de edición dentro de la herramienta embebida.

Una solapa sin `ID_HERRAMIENTA` (vacía) siempre se muestra si `VISIBLE=true`, sin chequeo de permisos — no hay nada que proteger.

## Herramientas embebidas de hoy

- **`LEGAJO_DAT_1`** ("Datos de Legajo"): vista simple de campos del legajo, con botón de edición por campo. `NUMERO` es editable; `ESTADO` es de solo lectura (el motor de estados todavía no tiene los Stored Procedures de transición — ver ADR 0009 y `domain/motor-de-estados.md` — cambiarlo a mano dejaría el dato inconsistente con `HISTORIAL`). `ALTA_FECHA`/`AUDIT_FECHA` y sus usuarios son de auditoría, tampoco editables.
- **`LEGAJO_CLI_1`** ("ABM de Clientes"): maestro-detalle acotado a los `CLIENTES` del legajo actual — lista a la izquierda, campos editables uno por uno a la derecha (mismo patrón de `LEGAJO_DAT_1`).

Ninguna de las dos tiene entrada en `MENUES_OPCIONES` — no son navegables por sidebar, solo se llega a ellas a través de un layout de legajo.

## ABM

**`/dashboard/layouts-legajo`** (`HERRAMIENTAS.CODIGO = 'layouts_legajo'`, con entrada en el menú Configuración): maestro-detalle — a la izquierda los `LAYOUTS_LEGAJO`, a la derecha las `LAYOUTS_LEGAJO_SOLAPAS` de la seleccionada (agregar/editar/borrar, con orden 1 a 10, nombre, y un desplegable de herramienta). El desplegable de herramienta solo lista las que el frontend realmente sabe renderizar embebidas (`Object.keys(LEGAJO_HERRAMIENTAS)` en `lib/legajo-herramientas.ts`) — evita configurar una herramienta "huérfana".

El campo `BANDEJAS.ID_LAYOUT` se edita desde el ABM de Bandejas (`/dashboard/bandejas-admin`), no desde acá — es una propiedad de la bandeja, no de la relación inversa.

## Seed

El seed de configuración modelo (`seed-config.ts`) crea `Layout Legajo Default 1` con: solapa 1 "Datos" (`LEGAJO_DAT_1`), solapa 2 "Clientes" (`LEGAJO_CLI_1`), solapa 3 "Solapa 3" (vacía, visible), y setea `BANDEJAS.ID_LAYOUT` de la bandeja `legajos` apuntando a este layout. Las solapas 4 a 10 no tienen fila.
