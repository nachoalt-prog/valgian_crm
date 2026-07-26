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

### PERMISOS

| Campo | Tipo |
|---|---|
| ID | UUID, PK |
| ID_PERFIL | FK → PERFILES |
| ID_HERRAMIENTA | FK → HERRAMIENTAS |
| GESTIONAR | boolean |

**Regla — unicidad**: a lo sumo una fila de `PERMISOS` por combinación (`ID_PERFIL`, `ID_HERRAMIENTA`). Constraint UNIQUE.

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

`PERMISOS` conecta `PERFILES` con `HERRAMIENTAS`. La existencia de la fila ya implica acceso de lectura — no hay columna `VER` separada. `GESTIONAR` es el único flag: distingue "puede ver y usar" de "puede además crear/editar/borrar". No hay niveles más granulares por ahora — ver `open-issues.md`.

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
