# Dominio — Bandejas

Buscador configurable: se elige una bandeja (a la izquierda) y se muestra su formulario de filtros y su listado de resultados (a la derecha) — filtros y columnas son dinámicos según la bandeja elegida. Sirve para buscar legajos, clientes o trámites sin que cada búsqueda sea una pantalla de código distinta.

## Tablas

### FILTROS

| Campo  | Tipo                                                            |
| ------ | ---------------------------------------------------------------- |
| ID     | UUID, PK                                                          |
| CODIGO | string                                                            |
| NOMBRE | string                                                            |
| TIPO   | string: `texto_like` \| `select` \| `fecha` \| `fecha_rango`      |
| QUERY  | text, nullable — solo para `TIPO='select'` (ver más abajo)        |

### BANDEJAS

| Campo    | Tipo                                                     |
| -------- | --------------------------------------------------------- |
| ID       | UUID, PK                                                   |
| CODIGO   | string                                                     |
| NOMBRE   | string                                                     |
| QUERY    | text, nullable — SQL base de la bandeja (ver más abajo)    |
| COLUMNAS | jsonb, nullable — columnas visibles del listado            |

### BANDEJAS_FILTROS

| Campo      | Tipo                                                  |
| ---------- | ------------------------------------------------------ |
| ID         | UUID, PK                                                |
| ID_BANDEJA | FK → BANDEJAS                                           |
| ID_FILTRO  | FK → FILTROS                                            |
| CAMPO      | string, nullable — alias de BANDEJAS.QUERY al que aplica |
| ORDEN      | integer, nullable — posición en el formulario           |

Sin constraint de unicidad (mismo patrón que `TRANSICIONES_ACCIONES`): es una tabla ordenada, no de pertenencia simple.

### BANDEJAS_PERFILES

| Campo      | Tipo             |
| ---------- | ---------------- |
| ID         | UUID, PK          |
| ID_BANDEJA | FK → BANDEJAS     |
| ID_PERFIL  | FK → PERFILES     |

Unique constraint sobre (`ID_BANDEJA`, `ID_PERFIL`) — mismo patrón que `PERMISOS`/`INTERFACES_MENUES`. Controla qué bandejas ve cada perfil **dentro** de la herramienta — es un permiso más fino que el de `PERMISOS` sobre la `HERRAMIENTA` "Bandejas" (ese solo gobierna si el perfil entra a la herramienta; `BANDEJAS_PERFILES` gobierna cuáles bandejas ve una vez adentro).

## Mecanismo de dinamismo

Siguiendo el mismo criterio que ADR 0009 (lógica de negocio configurable vive en SQL real, no en código que la aplicación interpreta — ahí aplicado a `ACCIONES.COMANDO`):

- **`BANDEJAS.QUERY`** es un `SELECT` completo con alias explícitos (`SELECT L."NUMERO" AS numero, ...`). Puede traer más columnas de las que se muestran — columnas que solo sirven para filtrar (ej. el apellido del titular por separado, aunque el listado muestre "Titular" combinado).
- **Ejecución real**: la query se envuelve — `SELECT * FROM (<BANDEJAS.QUERY>) AS b WHERE <condiciones>` — y las condiciones se arman contra los **alias de salida**, no contra las tablas/joins originales de adentro. Esto desacopla los filtros del join interno de cada bandeja.
- **`BANDEJAS.COLUMNAS`** decide qué alias de esos se muestran como columnas del listado, en qué orden y con qué label — ej. `[{"campo": "numero", "label": "Nro. Legajo"}, {"campo": "titular", "label": "Titular"}]`. No todo alias de `QUERY` termina siendo columna.
- **`BANDEJAS_FILTROS.CAMPO`** conecta un `FILTRO` (la forma reutilizable: tipo de control + label) a un alias puntual de una bandeja puntual. Un mismo `FILTRO` "texto simple" puede reusarse en distintas bandejas apuntando a columnas distintas.
- **`FILTROS.QUERY`** (solo `TIPO='select'`) es el `SELECT` que devuelve las opciones del desplegable — dos columnas, `value`/`label`. Ejemplos: todos los `ESTADOS` de la estrategia de esa bandeja, o todos los `USUARIOS`.

## Seguridad — parametrización obligatoria

El SQL de `BANDEJAS.QUERY`/`FILTROS.QUERY` es contenido de confianza (autorado por quien arma la bandeja, mismo nivel que `ACCIONES.COMANDO`) — pero los **valores que tipea el usuario en el formulario de búsqueda siempre se pasan parametrizados** (placeholders con bind, nunca interpolación de string). Esto no es negociable: mezclar SQL de confianza con datos de usuario sin parametrizar abre una inyección SQL, aunque la estructura de la query sea de confianza.

## Alcance actual

Hoy `FILTROS`/`BANDEJAS`/`BANDEJAS_FILTROS`/`BANDEJAS_PERFILES` se cargan únicamente por seed — no hay un ABM visual para armarlas desde la UI (implica escribir el `QUERY`/`COLUMNAS` a mano). Un editor que permita construir esto sin SQL manual queda pendiente — ver `open-issues.md`.
