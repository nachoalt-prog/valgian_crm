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

### TIPOS_EMAIL

| Campo  | Tipo     |
| ------ | -------- |
| ID     | UUID, PK |
| CODIGO | string   |
| NOMBRE | string   |

### EMAILS

| Campo         | Tipo             |
| ------------- | ---------------- |
| ID            | UUID, PK         |
| ID_CLIENTE    | FK → CLIENTES    |
| ID_TIPO_EMAIL | FK → TIPOS_EMAIL |
| EMAIL         | string           |
| PRINCIPAL     | boolean          |
| ALTA_FECHA    | timestamp        |
| ALTA_USUARIO  | FK → USUARIOS    |
| AUDIT_FECHA   | timestamp        |
| AUDIT_USUARIO | FK → USUARIOS    |

## Productos y cuentas

Cadena de configuración de producto → instancia real por legajo.

### PRODUCTOS

| Campo   | Tipo                                                                      |
| ------- | ------------------------------------------------------------------------- |
| ID      | UUID, PK                                                                  |
| MODULO  | string (prefijo de la tabla de extensión correspondiente, ej. 'XP', 'XS') |
| CODIGO  | string                                                                    |
| NOMBRE  | string                                                                    |
| COMODIN | jsonb, nullable                                                           |

### SUB_PRODUCTOS

| Campo       | Tipo            |
| ----------- | --------------- |
| ID          | UUID, PK        |
| ID_PRODUCTO | FK → PRODUCTOS  |
| CODIGO      | string          |
| NOMBRE      | string          |
| COMODIN     | jsonb, nullable |

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

Tabla creada deliberadamente mínima (schema-only, sin ABM ni seed todavía) como base para la fase de Trámites (ver `domain/tramites.md`, que sí referencia `CUENTAS` como una de las entidades sobre las que puede aplicarse un trámite). Referencia `PRODUCTOS` directo, no `SUB_PRODUCTOS` — la idea original de extensiones 1 a 1 por tipo de producto (`XP_CUENTAS`, etc.) queda pendiente de retomar cuando se implemente el ABM real, ver `open-issues.md`.

## Entidades (catálogo transversal)

### ENTIDADES

| Campo  | Tipo                                          |
| ------ | --------------------------------------------- |
| ID     | UUID, PK                                      |
| CODIGO | string                                        |
| NOMBRE | string (ej. 'CLIENTES', 'LEGAJOS', 'CUENTAS') |

Catálogo de qué tablas del sistema son "relacionables" desde funcionalidades genéricas, vía el patrón `ID_ENTIDAD` + `ID_RELACION` (asociación polimórfica). Usado hoy por `HISTORIAL` (ver `domain/motor-de-estados.md`); a futuro, por el módulo de mensajería.

**Nota sobre el patrón**: al no ser un FK real de base de datos, la integridad referencial de `ID_ENTIDAD`/`ID_RELACION` no la garantiza Postgres — se valida a nivel aplicación.
