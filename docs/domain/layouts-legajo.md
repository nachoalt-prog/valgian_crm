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
| PARAMETROS     | jsonb, nullable — ver `domain/infraestructura.md`, "Parámetros por punto de acceso" |

Unique sobre (`ID_LAYOUT`, `ORDEN`). Solo existen filas para las solapas configuradas — las que no tienen fila quedan ocultas y vacías por defecto (no hace falta crear 10 filas siempre).

### BANDEJAS.ID_LAYOUT

Una bandeja mapea a **un único** layout — por eso vive como columna nullable en `BANDEJAS` (`ID_LAYOUT`, FK → `LAYOUTS_LEGAJO`) y no como tabla de relación aparte. No hace falta unique adicional: al ser una sola columna, cada bandeja solo puede apuntar a un layout por definición.

## Mecanismo de herramienta embebida

Una `HERRAMIENTA` asignada a una solapa no es necesariamente una página navegable por sidebar — puede ser una herramienta que **solo** se usa embebida dentro de un layout de legajo (ej. `LEGAJO_DAT_1`, `LEGAJO_CLI_1`). El mapeo `HERRAMIENTAS.CODIGO → componente React` vive en código (`apps/web/src/lib/legajo-herramientas.ts`), mismo criterio de indirección que `lib/icons.ts` (ADR 0011): la clave es estable, el componente real puede cambiar de nombre/archivo sin tocar la base.

El componente recibe `{ idLegajo, idEntidad, canGestionar, parametros }` como props — el legajo sobre el que se está parado, el `ID` de `ENTIDADES` para "legajos" (lo necesitan las herramientas genéricas de motor de estados; las demás lo ignoran), si el perfil actual puede editar (ver más abajo), y el `PARAMETROS` de ESTA fila de `LAYOUTS_LEGAJO_SOLAPAS` (la mayoría de las herramientas lo ignoran; ver `domain/infraestructura.md`). El usuario logueado se resuelve dentro de cada action vía sesión, no se pasa como prop. `idEntidad` lo resuelve `legajo-layout-modal.tsx` una sola vez (vía `getEntidadLegajoAction`) y lo pasa a todas las herramientas de la solapa activa; `parametros` en cambio es por-solapa, cada una recibe el suyo.

## Permisos por solapa

Cada solapa con `ID_HERRAMIENTA` asignado respeta el mismo criterio que el resto de la app: si el perfil no tiene ninguna fila en `PERMISOS` para la operación `acceso` de esa herramienta (ver `domain/infraestructura.md`, "Modelo de permisos"), **la solapa entera queda oculta** (no aparece como botón siquiera) — no es un simple "solo lectura". Si la fila existe, la herramienta embebida se ve completa — salvo `LEGAJO_ADJ_1` (Archivos Adjuntos), que además resuelve sus propias operaciones granulares para habilitar/deshabilitar cada botón individualmente (ver `domain/archivos-adjuntos.md`).

Una solapa sin `ID_HERRAMIENTA` (vacía) siempre se muestra si `VISIBLE=true`, sin chequeo de permisos — no hay nada que proteger.

## Herramientas embebidas de hoy

- **`LEGAJO_DAT_1`** ("Datos de Legajo"): vista simple de campos del legajo, con botón de edición por campo. `NUMERO` es editable; `ESTADO` es de solo lectura (el motor de estados todavía no tiene los Stored Procedures de transición — ver ADR 0009 y `domain/motor-de-estados.md` — cambiarlo a mano dejaría el dato inconsistente con `HISTORIAL`). `ALTA_FECHA`/`AUDIT_FECHA` y sus usuarios son de auditoría, tampoco editables.
- **`LEGAJO_CLI_1`** ("ABM de Clientes"): maestro-detalle acotado a los `CLIENTES` del legajo actual — lista a la izquierda, campos editables uno por uno a la derecha (mismo patrón de `LEGAJO_DAT_1`).
- **`GESTION_ENTIDAD_1`** ("Gestión de Entidad"): la que le da uso real al motor de estados — selector de estímulos aplicables desde el estado actual (filtrado por `PERFILES_ESTIMULOS`), observación, y botón "Gestionar" que ejecuta `SP_APLICAR_ESTIMULO`. Ver `domain/motor-de-estados.md`.
- **`HISTORIAL_1`** ("Historial"): listado de solo lectura de `HISTORIAL` filtrado por `ID_ENTIDAD`/`ID_RELACION`, ordenado por `AUDIT_FECHA` descendente. Columnas: Estado INI, Estímulo, Estado FIN (nombres resueltos, no UUIDs), Fecha (`dd/mm/yyyy hh:mm`), Usuario, Status de acciones (`OK` si `ACCIONES_STATUS` es null, si no el mensaje de `ACCIONES_ERROR`) y Observación (con wrap de texto — puede ser largo).
- **`TRAMITES_1`** ("Trámites"): ABM completo de trámites (lanzar nuevos + listado + filtros) sobre el legajo actual, sus clientes y sus cuentas. Ver `domain/tramites.md`.
- **`LEGAJO_ADJ_1`** ("Archivos Adjuntos"): grilla de adjuntos del legajo, con operaciones granulares propias y soporte de `PARAMETROS`. Ver `domain/archivos-adjuntos.md`.

Ninguna de las seis tiene entrada en `MENUES_OPCIONES` — no son navegables por sidebar, solo se llega a ellas a través de un layout de legajo.

## ABM

**`/dashboard/layouts-legajo`** (`HERRAMIENTAS.CODIGO = 'layouts_legajo'`, con entrada en el menú Configuración): maestro-detalle — a la izquierda los `LAYOUTS_LEGAJO`, a la derecha las `LAYOUTS_LEGAJO_SOLAPAS` de la seleccionada (agregar/editar/borrar, con orden 1 a 10, nombre, un desplegable de herramienta, y un textarea de `PARAMETROS` en JSON crudo). El desplegable de herramienta solo lista las que el frontend realmente sabe renderizar embebidas (`Object.keys(LEGAJO_HERRAMIENTAS)` en `lib/legajo-herramientas.ts`) — evita configurar una herramienta "huérfana". El textarea de `PARAMETROS` es JSON libre sin validación de forma más allá de "es JSON válido" — cada herramienta interpreta sus propias claves (ver `domain/infraestructura.md`).

El campo `BANDEJAS.ID_LAYOUT` se edita desde el ABM de Bandejas (`/dashboard/bandejas-admin`), no desde acá — es una propiedad de la bandeja, no de la relación inversa.

## Seed

El seed de configuración modelo (`seed-config.ts`) crea `Layout Legajo Default 1` con: solapa 1 "Datos" (`LEGAJO_DAT_1`), solapa 2 "Clientes" (`LEGAJO_CLI_1`), solapa 3 "Gestión" (`GESTION_ENTIDAD_1`), solapa 4 "Historial" (`HISTORIAL_1`), solapa 5 "Trámites" (`TRAMITES_1`), solapa 6 "Adjuntos" (`LEGAJO_ADJ_1`), y setea `BANDEJAS.ID_LAYOUT` de la bandeja `legajos` apuntando a este layout. Las solapas 7 a 10 no tienen fila. El mismo seed crea la estrategia `STD_LEGAJO_1` (ver `domain/motor-de-estados.md`) y le da al perfil admin los 3 estímulos vía `PERFILES_ESTIMULOS` — sin eso, "Gestión de Entidad" no mostraría ningún estímulo aunque el admin tenga permiso sobre la herramienta. La estrategia `STD_TRAMITE_1` y sus `PERFILES_ESTIMULOS` se crean igual, para trámites — ver `domain/tramites.md`.
