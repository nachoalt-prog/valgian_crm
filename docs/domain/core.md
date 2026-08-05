# Dominio — Core

Legajos, clientes, cuentas y productos. Entidad raíz del sistema y todo lo que cuelga directamente de ella.

## Convenciones generales

Aplican a todas las tablas del sistema salvo indicación contraria — ver también `domain/infraestructura.md` para USUARIOS, referenciado en los campos de auditoría de esta página.

- **Claves primarias**: ID de tipo UUID en todas las tablas. Ver ADR 0008.
- **Auditoría de alta**: `ALTA_FECHA` (timestamp), `ALTA_USUARIO` (FK → USUARIOS).
- **Auditoría de modificación**: `AUDIT_FECHA` (timestamp), `AUDIT_USUARIO` (FK → USUARIOS).
- **COMODIN** (`jsonb`, nullable): presente en varias tablas de catálogo como espacio abierto para extensibilidad por cliente, sin propósito fijo predefinido. Resuelve la extensibilidad por cliente mencionada en ADR 0002 (JSONB en campos puntuales, no cambios de schema).
- **Naming**: tablas en MAYÚSCULAS_CON_GUION_BAJO, en plural. Catálogos de "tipos" siguen el patrón `TIPOS_<CONCEPTO>` en singular (`TIPOS_TELEFONO`, `TIPOS_EMAIL`, `TIPOS_DOCUMENTO`).
- **Nullability por defecto**: todo campo es nullable salvo el UUID de PK, `CODIGO`, `NOMBRE` y `NUMERO` en `LEGAJOS`/`CUENTAS` (identificador de negocio, mismo criterio en ambas). Regla temporal, sujeta a ajuste caso por caso a medida que se implementan los ABMs.
- **Integridad referencial**: no hay `ON DELETE CASCADE` en ningún FK del sistema — comportamiento default `RESTRICT`, no se puede borrar un registro referenciado desde otra tabla. La política de baja lógica vs. física en los ABMs sigue sin definir (ver `open-issues.md`).

## Ubicación geográfica

### PAISES

| Campo  | Tipo     |
| ------ | -------- |
| ID     | UUID, PK |
| CODIGO | string   |
| NOMBRE | string   |

### PROVINCIAS

| Campo   | Tipo        |
| ------- | ----------- |
| ID      | UUID, PK    |
| ID_PAIS | FK → PAISES |
| CODIGO  | string      |
| NOMBRE  | string      |

### TIPOS_FERIADO / FERIADOS

| Campo (TIPOS_FERIADO) | Tipo     |
| ---------------------- | -------- |
| ID                     | UUID, PK |
| CODIGO                 | string   |
| NOMBRE                 | string   |

| Campo (FERIADOS) | Tipo                                     |
| ------------------ | ----------------------------------------- |
| ID                  | UUID, PK                                   |
| ID_TIPO_FERIADO     | FK → TIPOS_FERIADO                         |
| FECHA               | date, único                                |
| DESCRIPCION         | string, nullable                           |

Genérico (no específico de ningún módulo) — cualquiera que necesite noción de "día hábil" las consulta vía `fn_es_dia_habil` (`packages/db/sql/0020_fn_es_dia_habil.sql`, función del core, no del módulo Cuenta Corriente que la motivó — ver `docs/módulo XCC`). Los 4 `TIPOS_FERIADO` (no laborable/inamovible/trasladable/turístico) son catálogo real y permanente, sembrados siempre — lo que sí es dato de PRUEBA son las filas puntuales de `FERIADOS`: el calendario real completo queda para un módulo futuro que lo puebla desde un servicio externo (ver `open-issues.md`).

## Legajos

Entidad raíz del sistema — el expediente central del que cuelga todo lo demás. Deliberadamente mínima: el detalle vive en las entidades relacionadas.

### LEGAJOS

| Campo         | Tipo                                            |
| ------------- | ----------------------------------------------- |
| ID            | UUID, PK                                        |
| NUMERO        | string                                          |
| ID_ESTADO     | FK → ESTADOS (ver `domain/motor-de-estados.md`) |
| ALTA_FECHA    | timestamp                                       |
| ALTA_USUARIO  | FK → USUARIOS                                   |
| AUDIT_FECHA   | timestamp                                       |
| AUDIT_USUARIO | FK → USUARIOS                                   |
| COMODIN       | jsonb, nullable                                 |

**Regla**: todo legajo se crea con un `ID_ESTADO` inicial asignado — no existe un legajo sin estado. El estado inicial de la estrategia correspondiente se identifica vía `ESTADOS.ES_INICIAL` (ver `domain/motor-de-estados.md`) — depende del creador asignarle el estado.

**Nota — generación de NUMERO**: el proceso de originación/alta de un legajo (y por lo tanto cómo se genera o asigna `NUMERO`) depende de cada instalación del producto — no es una regla fija del core genérico.

## Clientes

Personas asociadas a un legajo. Un legajo tiene N clientes, con exactamente uno marcado como titular.

### CARACTERES

| Campo  | Tipo                                            |
| ------ | ----------------------------------------------- |
| ID     | UUID, PK                                        |
| CODIGO | string                                          |
| NOMBRE | string (ej. 'Titular', 'Adicional', 'Pariente') |

### TIPOS_DOCUMENTO

| Campo  | Tipo     |
| ------ | -------- |
| ID     | UUID, PK |
| CODIGO | string   |
| NOMBRE | string   |

### GENEROS

| Campo  | Tipo     |
| ------ | -------- |
| ID     | UUID, PK |
| CODIGO | string   |
| NOMBRE | string   |

### CLIENTES

| Campo             | Tipo                      |
| ----------------- | ------------------------- |
| ID                | UUID, PK                  |
| ID_LEGAJO         | FK → LEGAJOS              |
| ID_CARACTER       | FK → CARACTERES           |
| ES_TITULAR        | boolean                   |
| ID_TIPO_DOCUMENTO | FK → TIPOS_DOCUMENTO      |
| NRO_DOCUMENTO     | string                    |
| APELLIDO          | string                    |
| NOMBRE            | string                    |
| ID_GENERO         | FK → GENEROS              |
| ID_PROVINCIA      | FK → PROVINCIAS, nullable |
| ALTA_FECHA        | timestamp                 |
| ALTA_USUARIO      | FK → USUARIOS             |
| AUDIT_FECHA       | timestamp                 |
| AUDIT_USUARIO     | FK → USUARIOS             |

**Regla — unicidad de titular**: solo puede existir un `CLIENTES` con `ES_TITULAR = true` por `ID_LEGAJO`. Implementada con un trigger: al insertar o actualizar una fila con `ES_TITULAR = true`, el resto de los clientes del mismo legajo se ponen en `false` automáticamente.

**Nota**: una misma persona física puede existir como múltiples filas de `CLIENTES`, una por cada legajo en el que participa — no hay deduplicación global hoy. Ver `open-issues.md`.

## Teléfonos y emails

### TIPOS_TELEFONO

| Campo  | Tipo     |
| ------ | -------- |
| ID     | UUID, PK |
| CODIGO | string   |
| NOMBRE | string   |

### TELEFONOS

| Campo            | Tipo                                           |
| ---------------- | ---------------------------------------------- |
| ID               | UUID, PK                                       |
| ID_CLIENTE       | FK → CLIENTES                                  |
| ID_TIPO_TELEFONO | FK → TIPOS_TELEFONO                            |
| CODIGO_PAIS      | string                                         |
| CODIGO_AREA      | string                                         |
| NUMERO           | string                                         |
| RAW_NUMERO       | string (número tal cual se cargó, sin separar) |
| PRINCIPAL        | boolean                                        |
| ALTA_FECHA       | timestamp                                      |
| ALTA_USUARIO     | FK → USUARIOS                                  |
| AUDIT_FECHA      | timestamp                                      |
| AUDIT_USUARIO    | FK → USUARIOS                                  |

### EMAILS

Implementada (`packages/core/src/emails.ts`) más simple que el diseño planeado originalmente acá — sin catálogo `TIPOS_EMAIL`, con `COMODIN` en su lugar (mismo criterio flexible que `LEGAJOS.COMODIN`/`CUENTAS.COMODIN`).

| Campo         | Tipo          |
| ------------- | ------------- |
| ID            | UUID, PK      |
| EMAIL         | string        |
| PRINCIPAL     | boolean       |
| ID_CLIENTE    | FK → CLIENTES |
| COMODIN       | jsonb         |
| ALTA_FECHA    | timestamp     |
| ALTA_USUARIO  | FK → USUARIOS |
| AUDIT_FECHA   | timestamp     |
| AUDIT_USUARIO | FK → USUARIOS |

**Regla — unicidad de principal**: solo puede existir un `EMAILS` con `PRINCIPAL = true` por `ID_CLIENTE` — mismo trigger de auto-swap que `CLIENTES.ES_TITULAR` (`packages/db/sql/0010_trigger_emails_principal.sql`).

ABM embebido en el modal de Legajo, dentro de la herramienta de Clientes (botón "Emails" en el panel de detalle) — no es una pantalla propia. `ALTA_FECHA`/`ALTA_USUARIO`/`AUDIT_FECHA`/`AUDIT_USUARIO` se completan solo desde el server action, nunca son parte del formulario editable. Ver `domain/acciones-externas.md` para cómo lo consume Mensajería (`MENSAJERIA_COLA.DESTINO`).

`TELEFONOS`/`TIPOS_TELEFONO` arriba siguen siendo diseño no implementado — a diferencia de `EMAILS`, todavía no hubo un sprint que los baje a código.

## Productos y cuentas

Cadena de configuración de producto → instancia real por legajo. `PRODUCTOS`/`SUB_PRODUCTOS` se renombraron a `CATEGORIAS_PRODUCTOS`/`PRODUCTOS` (el nivel específico pasa a llamarse simplemente "producto", sin el prefijo "sub-") como parte de la Fase 1 del módulo Cuenta Corriente (ver `docs/módulo XCC`) — cualquier módulo opcional de producto futuro (préstamos, tarjetas...) usa esta misma cadena, no es exclusivo de XCC.

### CATEGORIAS_PRODUCTOS

| Campo          | Tipo                                                                       |
| -------------- | --------------------------------------------------------------------------- |
| ID             | UUID, PK                                                                    |
| MODULO         | string, nullable — código del módulo opcional dueño de esta categoría      |
| CODIGO         | string                                                                      |
| NOMBRE         | string                                                                      |
| SP_PAGO        | string, nullable — nombre de SP invocado dinámicamente por un motor genérico de pagos para impactar un pago de esta categoría (mismo patrón que `ACCIONES.COMANDO`) |
| SP_ANULAR_PAGO | string, nullable — ídem, para anular un pago                               |
| COMODIN        | jsonb, nullable                                                            |

### PRODUCTOS

| Campo         | Tipo                        |
| ------------- | --------------------------- |
| ID            | UUID, PK                    |
| ID_CATEGORIA  | FK → CATEGORIAS_PRODUCTOS   |
| ID_MONEDA     | FK → MONEDAS, nullable      |
| CODIGO        | string                      |
| NOMBRE        | string                      |
| COMODIN       | jsonb, nullable             |

ABM propio en `/dashboard/productos` (`packages/core/src/productos.ts`), maestro-detalle: categorías a la izquierda, productos de la categoría seleccionada a la derecha — mismo patrón visual que otros ABMs maestro-detalle del proyecto.

### CUENTAS

| Campo         | Tipo                                            |
| ------------- | ------------------------------------------------ |
| ID            | UUID, PK                                         |
| ID_LEGAJO     | FK → LEGAJOS                                     |
| NUMERO        | string                                           |
| ID_PRODUCTO   | FK → PRODUCTOS                                   |
| ID_ESTADO     | FK → ESTADOS (ver `domain/motor-de-estados.md`)  |
| ALTA_FECHA    | timestamp                                        |
| ALTA_USUARIO  | FK → USUARIOS                                    |
| AUDIT_FECHA   | timestamp                                        |
| AUDIT_USUARIO | FK → USUARIOS                                    |
| COMODIN       | jsonb, nullable                                  |

Ya participa del subsistema de Trámites (`ENTIDADES.CODIGO = 'cuentas'`, usada como "Aplicar a" — ver `domain/tramites.md`) y, desde la Fase 1 del módulo Cuenta Corriente, tiene motor de estados propio (`ESTRATEGIAS.CODIGO = 'STD_CUENTA_1'`, estados Abierta/Cerrada — una cuenta nace directo en Abierta, sin estado intermedio). Sigue sin ABM de alta/edición ni seed de datos de ejemplo — eso es del módulo Cuenta Corriente (`docs/módulo XCC`), no del core.

### Canales de pago y desembolso (core, genérico)

Tablas para que cualquier módulo de producto pueda cobrar/pagar sin reinventar el mecanismo: `ENTES` (quién mueve la plata — Caja, RapiPago, MercadoPago...), `FORMAS_PAGO`/`FORMAS_DESEMBOLSO` (cómo — efectivo, transferencia, débito automático...), `CANALES_PAGO`/`CANALES_DESEMBOLSO` (vínculo único `ENTES`×`FORMAS_*`), y `PRODUCTOS_CANALES_PAGO`/`PRODUCTOS_CANALES_DESEMBOLSO` (qué canales están habilitados para cada `PRODUCTOS` puntual — acá se resuelve la variación por categoría, sin necesitar forkear `ENTES`/`FORMAS_PAGO` por tipo de producto). Sin ABM ni datos todavía — quedan como schema puro hasta que un módulo (XCC u otro) las use.

## Entidades (catálogo transversal)

### ENTIDADES

| Campo  | Tipo                                          |
| ------ | --------------------------------------------- |
| ID     | UUID, PK                                      |
| CODIGO | string                                        |
| NOMBRE | string (ej. 'CLIENTES', 'LEGAJOS', 'CUENTAS') |

Catálogo de qué tablas del sistema son "relacionables" desde funcionalidades genéricas, vía el patrón `ID_ENTIDAD` + `ID_RELACION` (asociación polimórfica). Usado hoy por `HISTORIAL` (ver `domain/motor-de-estados.md`); a futuro, por el módulo de mensajería.

**Nota sobre el patrón**: al no ser un FK real de base de datos, la integridad referencial de `ID_ENTIDAD`/`ID_RELACION` no la garantiza Postgres — se valida a nivel aplicación.
