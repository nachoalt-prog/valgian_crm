# Dominio — Infraestructura de aplicación

Usuarios, permisos, y configuración de interfaz. No es "negocio" del CRM en sí, pero sostiene cualquier pantalla y control de acceso.

## Tablas

### INTERFAZ

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| CODIGO | string |
| NOMBRE | string |
| FUENTE | string (identificador del layout, resuelto en código) |
| COLOR_PRIMARIO | string |
| COLOR_SECUNDARIO | string |
| TITULO | string, nullable (texto de marca mostrado en el shell post-login, ej. donde hoy dice "Valgian") |
| IMAGEN_FONDO | string, nullable (ruta o URL de una imagen — ver "Interfaz" más abajo para dónde y cómo se usa) |

### PERFILES

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| CODIGO | string |
| NOMBRE | string |
| ID_INTERFAZ | FK → INTERFAZ |
| COMODIN | jsonb, nullable |

### USUARIOS

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_PERFIL | FK → PERFILES |
| USERNAME | string, UNIQUE |
| PASSWORD_HASH | string (Argon2id) |
| TOKEN | string, nullable |
| TOKEN_EXPIRACION | timestamp, nullable |
| AVATAR_PATH | string, nullable (ruta relativa dentro del volumen de archivos de la instancia) |
| COMODIN | jsonb, nullable |

### HERRAMIENTAS

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| CODIGO | string |
| NOMBRE | string |
| SLUG | string (identificador estable usado en código y permisos, ej. 'legajos.listado') |
| COMODIN | jsonb, nullable |

### OPERACIONES

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_HERRAMIENTA | FK → HERRAMIENTAS |
| CODIGO | string |
| NOMBRE | string |

**Regla — unicidad**: a lo sumo una fila de `OPERACIONES` por combinación (`ID_HERRAMIENTA`, `CODIGO`). Constraint UNIQUE.

Toda herramienta tiene como mínimo la operación `CODIGO = 'acceso'` — el permiso sobre esa operación es lo que hoy decide si la herramienta se ve o no (equivalente al viejo `GESTIONAR`, de momento). Una herramienta puede sumar operaciones más finas para gatillar botones/acciones puntuales — ver "Modelo de permisos" más abajo.

### PERMISOS

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_PERFIL | FK → PERFILES |
| ID_OPERACION | FK → OPERACIONES |

**Regla — unicidad**: a lo sumo una fila de `PERMISOS` por combinación (`ID_PERFIL`, `ID_OPERACION`). Constraint UNIQUE. Un perfil puede tener varias filas de `PERMISOS` para la misma herramienta — una por cada operación que tenga habilitada.

### MENUES

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| CODIGO | string |
| NOMBRE | string (ej. 'ABMs') |
| COMODIN | jsonb, nullable |

### MENUES_OPCIONES

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_MENU | FK → MENUES |
| ID_HERRAMIENTA | FK → HERRAMIENTAS |
| CODIGO | string |
| NOMBRE | string |
| ICONO | string (clave propia y estable, ej. 'icon.legajos' — ver ADR 0011) |
| ORDEN | integer |
| COMODIN | jsonb, nullable |

### INTERFACES_MENUES

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_INTERFAZ | FK → INTERFAZ |
| ID_MENU | FK → MENUES |

**Regla — unicidad**: a lo sumo una fila por combinación (`ID_INTERFAZ`, `ID_MENU`). Constraint UNIQUE.

## Autenticación

Contraseñas hasheadas con Argon2id.

El login genera un `TOKEN` guardado directo en `USUARIOS`, junto con `TOKEN_EXPIRACION`. No hay tabla `SESIONES` separada. Toda operación en el sistema requiere ese token; si es inválido o expiró, se fuerza un nuevo login.

Un usuario solo puede tener una sesión activa a la vez — loguearse en un segundo dispositivo invalida la del primero. Ver ADR 0010.

Cada instalación arranca con un seed que crea un usuario administrador inicial.

`USUARIOS.USERNAME` es único — no puede haber dos usuarios con el mismo username en la misma instancia.

## Modelo de permisos

`HERRAMIENTAS` es el catálogo central de todo lo permisable en el sistema. No toda herramienta necesita una entrada de menú — `MENUES_OPCIONES` es solo una forma de llegar a una herramienta, no la única (permite controlar permisos sobre acciones a las que se llega sin pasar por el menú lateral, ej. desde el detalle de un legajo).

`PERMISOS` conecta `PERFILES` con `OPERACIONES` (no directamente con `HERRAMIENTAS` — la herramienta se deriva por JOIN vía `OPERACIONES.ID_HERRAMIENTA`). La existencia de la fila ya implica el permiso — no hay booleano adicional (reemplaza al viejo `PERMISOS.GESTIONAR`, que ya no existe).

**Única función de chequeo, sin excepciones**: `getPermisoParaOperacion(perfilId, herramientaCodigo, operacionCodigo)` en `packages/core/src/permissions.ts` — devuelve `boolean`. No existe (deliberadamente) una función separada tipo `getPermisoParaHerramienta`; todo el código, sin excepción, pasa por esta única función, variando el `operacionCodigo`. Para "¿tiene acceso a la herramienta?" se usa la constante exportada `OPERACION_ACCESO = "acceso"`.

De momento, todas las herramientas salvo una tienen una única operación (`OPERACION_ACCESO`) — la distinción vieja entre "puede ver" y "puede además gestionar" desapareció para esas herramientas (colapsan a un solo nivel: tener la fila es tener acceso completo). Es una decisión consciente, no un efecto secundario: en la práctica ninguna herramienta usaba hoy un perfil de solo-lectura (el seed siempre otorgó `GESTIONAR = true`), así que el riesgo real es nulo. El primer caso real con operaciones más finas es `LEGAJO_ADJ_1` (Archivos Adjuntos) — además de `acceso`, tiene `crear`, `reemplazar`, `descargar`, `guardar` y `borrar`, una por cada botón del modal de adjunto (ver `domain/archivos-adjuntos.md`). Cuando otra herramienta necesite este mismo nivel de detalle, se le suman sus propias filas en `OPERACIONES` — no hace falta ningún cambio de schema.

**ABM de Permisos** (`/dashboard/permisos`): la columna "Herramienta" sigue existiendo en la grilla aunque ahora es indirecta (derivada de la operación elegida). El modal filtra las opciones del combo Operación según la Herramienta elegida. Al editar un permiso existente, `Perfil` queda bloqueado (es la identidad del titular del permiso) pero `Herramienta` y `Operación` quedan editables — a diferencia del viejo `GESTIONAR` (un booleano que se tocaba en el lugar), reasignar la operación de una fila existente es la forma de corregirla sin borrar y volver a crear.

## Parámetros por punto de acceso

`PERMISOS` gobierna qué puede hacer un **perfil** — el mismo permiso vale sin importar desde dónde se llegue a la herramienta. `LAYOUTS_LEGAJO_SOLAPAS.PARAMETROS` y `MENUES_OPCIONES.PARAMETROS` (ambos `jsonb`, nullable) resuelven el problema complementario: restringir qué puede hacer una herramienta embebida en **este punto de acceso puntual**, sin tocar el permiso de nadie. Mismo archivo, misma herramienta, mismo perfil — pero la solapa A de un layout puede ser de solo-lectura mientras la solapa B del mismo layout (u otro) permite todo.

Config libre por diseño (`Record<string, unknown>`, editada como JSON crudo en ambos ABMs) — cada herramienta interpreta las claves que le interesan, ninguna tabla central las define. Ausente el `PARAMETROS` entero, o ausente una clave puntual dentro de él, significa "sin restricción adicional" — nunca hay que configurar algo para que ande como si `PARAMETROS` no existiera. Es una capa **adicional** a `PERMISOS`, nunca un reemplazo: primero se valida el permiso del perfil sobre la operación (server-side, real límite de seguridad), y **después**, solo si el permiso ya dio positivo, se aplica la restricción de `PARAMETROS` (hoy solo client-side — es config de un admin protegida por su propio ABM, no algo que un cliente pueda manipular para escalar privilegios).

**Primer y único consumidor real hoy**: `LEGAJO_ADJ_1` (Archivos Adjuntos) interpreta `{"crear": false, "reemplazar": false, "descargar": false, "borrar": false}` en `LAYOUTS_LEGAJO_SOLAPAS.PARAMETROS` — ver `domain/archivos-adjuntos.md`. `MENUES_OPCIONES.PARAMETROS` existe con el mismo mecanismo pero sin ningún caso real que lo ejercite todavía (ninguna herramienta con entrada de menú lo necesita hoy).

## Imágenes y archivos

Íconos de menú: `MENUES_OPCIONES.ICONO` guarda una clave propia y estable (no el nombre de un ícono de librería directamente), mapeada en código a un componente real de lucide-react. Ver ADR 0011.

Foto de perfil: `USUARIOS.AVATAR_PATH` guarda la ruta relativa del archivo dentro del volumen de archivos de la instancia (fuera de la base de datos). Ver ADR 0011.

## Interfaz

`INTERFAZ.FUENTE` selecciona un layout predefinido en código (no hay motor de renderizado dinámico configurable sin tocar código). `COLOR_PRIMARIO`/`COLOR_SECUNDARIO` permiten tematizar sin cambiar de layout. Un `PERFIL` apunta a una `INTERFAZ`; varios perfiles distintos pueden compartir la misma interfaz con permisos distintos entre sí.

Qué interfaz se usa en cada momento:
- **Antes de loguearse** (pantalla de login): no hay sesión todavía, así que se usa la `INTERFAZ` con `CODIGO = 'default'` como base.
- **Después de loguearse**: se usa la `INTERFAZ` del `PERFIL` del usuario logueado — cada perfil puede ver una marca/paleta distinta.

`TITULO` reemplaza el nombre de marca fijo que se mostraba en el shell (sidebar). Si es nulo, el código cae a un valor por defecto.

`IMAGEN_FONDO` solo se usa en la pantalla de login (nunca en el shell post-login): si tiene un valor, se muestra como imagen de fondo detrás del formulario, al 30% de opacidad (70% transparente), sin reemplazar el `COLOR_PRIMARIO`/fondo normal — se ve el color de siempre con la imagen apenas insinuada encima. Si es nulo, el fondo se ve exactamente como sin esta funcionalidad.
