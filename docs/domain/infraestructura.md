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

`COLOR_PRIMARIO`/`COLOR_SECUNDARIO` se guardan en formato hex (`#RRGGBB`) — editables en el ABM con un `<input type="color">` nativo junto al campo de texto (ambos sincronizados), ver "Interfaz" más abajo.

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

**Autodocumentado por herramienta** — `HERRAMIENTAS.PARAMETROS_EJEMPLO` (`jsonb`) y `HERRAMIENTAS.PARAMETROS_GUIA` (`text`), seteados por seed (sin ABM propio — `HERRAMIENTAS` sigue siendo solo-seed). En los dos editores de `PARAMETROS` (`LayoutSolapaDialog`, `MenuOpcionDialog`), al elegir una herramienta en el combo, el textarea de `PARAMETROS` toma como `placeholder` el `PARAMETROS_EJEMPLO` de esa herramienta, y debajo del campo se agrega su `PARAMETROS_GUIA` (después de un texto fijo genérico que no cambia). `PARAMETROS_EJEMPLO` admite dos formas válidas de contenido, ambas jsonb:
- Un objeto real (ej. `{"crear": true, "borrar": false, "reemplazar": true, "descargar": false}` para `LEGAJO_ADJ_1`) → el placeholder muestra ese JSON con formato.
- Un string JSON simple (ej. `"De momento esta herramienta no soporta parámetros"`, el valor por default para toda herramienta sin operaciones granulares) → el placeholder muestra ese texto tal cual, sin comillas.

## Imágenes y archivos

Íconos de menú: `MENUES_OPCIONES.ICONO` guarda una clave propia y estable (no el nombre de un ícono de librería directamente), mapeada en código a un componente real de lucide-react. Ver ADR 0011.

Foto de perfil: `USUARIOS.AVATAR_PATH` guarda la ruta relativa del archivo dentro del volumen de archivos de la instancia (fuera de la base de datos). Ver ADR 0011.

## Interfaz

`INTERFAZ.FUENTE` selecciona un layout predefinido en código (no hay motor de renderizado dinámico configurable sin tocar código). `COLOR_PRIMARIO`/`COLOR_SECUNDARIO` permiten tematizar sin cambiar de layout. Un `PERFIL` apunta a una `INTERFAZ`; varios perfiles distintos pueden compartir la misma interfaz con permisos distintos entre sí.

Qué interfaz se usa en cada momento (`COLOR_PRIMARIO`/`COLOR_SECUNDARIO` — el resto de `INTERFAZ`, ej. `IMAGEN_FONDO`, sigue usando siempre la `default` antes de loguearse):
- **Antes de loguearse, primera vez en este navegador** (sin cookie `interfaz_colores` todavía): se usa la `INTERFAZ` con `CODIGO = 'default'` como base.
- **Antes de loguearse, ya logueado alguna vez en este navegador**: se usan los colores guardados en la cookie `interfaz_colores` (`apps/web/src/lib/interfaz-colores.ts`) — la última interfaz REAL que vio ese navegador, no la `default` genérica. La cookie se escribe en `apps/web/src/app/login/actions.ts` justo después de un login exitoso, con los colores de la `INTERFAZ` del perfil que acaba de entrar. `apps/web/src/app/layout.tsx` la lee cuando no hay sesión activa.
- **Después de loguearse**: se usa la `INTERFAZ` del `PERFIL` del usuario logueado — cada perfil puede ver una marca/paleta distinta.

`TITULO` reemplaza el nombre de marca fijo que se mostraba en el shell (sidebar). Si es nulo, el código cae a un valor por defecto.

`IMAGEN_FONDO` solo se usa en la pantalla de login (nunca en el shell post-login): si tiene un valor, se muestra como imagen de fondo detrás del formulario, al 30% de opacidad (70% transparente), sin reemplazar el `COLOR_PRIMARIO`/fondo normal — se ve el color de siempre con la imagen apenas insinuada encima. Si es nulo, el fondo se ve exactamente como sin esta funcionalidad.

## Tema claro/oscuro

Independiente de `INTERFAZ` — es una preferencia de PANTALLA (clara/oscura), no de marca por perfil. `COLOR_PRIMARIO`/`COLOR_SECUNDARIO` (y sus derivados `--sidebar-primary`, `--ring`, `--chart-1`/`--chart-2`) son invariantes entre ambos temas, a propósito: la interfaz elegida para el perfil no cambia según el tema. El resto de la paleta (fondo, card, popover, secondary, muted, border, sidebar) sí cambia — ver `apps/web/src/app/globals.css`, bloques `.dark`/`.light`.

Mecanismo (sin `next-themes`, sin dependencia nueva — mismo patrón que ya usaba este layout para `INTERFAZ`, "leer algo server-side e inyectarlo antes del render"):
- Preferencia guardada en cookie `theme` (`light`/`dark`), NO en localStorage — así el servidor la lee con `cookies()` en `apps/web/src/app/layout.tsx` y setea la clase `light`/`dark` en `<html>` en el primer render, sin flash.
- Sin cookie todavía: se renderiza `dark` como default y un script `next/script` con `strategy="beforeInteractive"` corrige la clase antes del primer paint si `prefers-color-scheme: light` — no escribe cookie (sigue "siguiendo" al SO hasta que el usuario elija explícitamente).
- El switch vive en `apps/web/src/components/app-sidebar.tsx`, arriba de "Cerrar sesión". Al togglear, escribe la cookie (`apps/web/src/lib/theme.ts`) y cambia la clase en `<html>` en el momento, sin reload.
- `<html>` lleva `suppressHydrationWarning` — esperado con este patrón (React no puede saber de antemano si el script beforeInteractive tocó la clase).

## Menú lateral — grupos colapsables

Cada grupo del menú (`MenuGrupo.nombre`, ej. "ABMs", "Configuración") tiene su propio botón con chevron que oculta/muestra sus opciones — independiente del colapso GLOBAL del sidebar (que angosta todo a solo íconos). Estado en memoria (`useState` en `app-sidebar.tsx`, no persistido — se resetea a los valores de abajo en cada carga de página).

`MENUES.ORDEN` (integer) define el orden entre grupos (`getMenuForPerfil` los devuelve ya ordenados) — estándar: Principal=1, Herramientas=2, Configuración=3. `MENUES.ABIERTO` (boolean) define el estado inicial (desplegado/colapsado) la primera vez que se carga el sidebar tras loguearse — de ahí en más el usuario lo togglea libremente sin volver a leer la base. Ambos administrables desde el ABM de Menúes (`/dashboard/menues`) — para los 3 menúes estándar, también se resincronizan en cada corrida de `pnpm db:seed` (`ensureMenu`, a diferencia de `codigo`/`nombre`, que nunca se pisan).

El scroll del `<nav>` del sidebar usa la clase `.sidebar-scroll` (`apps/web/src/app/globals.css`) — fino (5px) y transparente por default, toma el color `--sidebar-primary` del sitio solo mientras el mouse está encima. `scrollbar-color`/`scrollbar-width` para Firefox, pseudo-elementos `::-webkit-scrollbar*` para Chrome/Edge/Safari — sin JS, puro CSS.

**Colapso global — click afuera**: el sidebar arranca expandido (`useState(false)` sobre `collapsed`, sin cookie ni localStorage — no hay estado que restaurar). Además del botón manual de siempre, un click en cualquier punto fuera del `<aside>` lo colapsa: un `useEffect` en `app-sidebar.tsx` agrega un listener `pointerdown` en `document` (solo mientras está expandido — se remueve solo, sin trabajo de más, apenas colapsa) y compara contra un `ref` puesto en el propio `<aside>` (`!asideRef.current.contains(e.target)`).

## Patrón: riel lateral colapsable

Nombre del patrón usado hoy por `BandejasPanel`/`ReportesPanel` (paneles izquierdos de las herramientas de Bandejas y Reportes) — pensado para que una herramienta nueva con el mismo layout ("listado a elegir a la izquierda, contenido a la derecha") lo pueda copiar sin reinventarlo.

Mismo lenguaje visual que el colapso global de arriba (ancho `w-14` colapsado), pero disparado distinto: acá colapsa al ELEGIR una opción de la lista (no por click afuera) — la idea es liberarle espacio al contenido de la derecha una vez que ya se sabe qué se está mirando. `BandejasPanel`/`ReportesPanel` reciben `collapsed`/`onToggleCollapsed` desde `BandejasTool`/`ReportesTool` (`panelCollapsed`, seteado a `true` al arrancar `handleSelectBandeja`/`handleSelectReporte`).

**Estado colapsado — toda la barra es el botón**: a diferencia del sidebar global (que en colapsado sigue teniendo un botón chico), acá el `<button>` ocupa el `h-full w-full` del riel — cualquier click adentro expande, no hace falta acertarle a un ícono de 28px. Estructura: el ícono de la herramienta (`Inbox`/`BarChart3`) queda arriba (`items-start` + `py-4`), y la flechita (`ChevronRight`) va en un `<span className="absolute inset-0 flex items-center justify-center">` — centrada en el medio de TODA la barra (no del espacio que queda debajo del ícono), independiente de éste. `Tooltip`/`TooltipContent` (`side="right"`) envuelve el botón entero.

**Estado expandido**: sin cambios respecto al sidebar global — un botón chico (`ChevronLeft`) en el header, al lado del ícono/título, para volver a colapsar manualmente sin tener que elegir otra opción de la lista.
