# Dominio — Reportes

Listado configurable de análisis: se elige un reporte (a la izquierda) y se muestra su formulario de filtros (arriba, a la derecha) y su listado de columnas/registros (abajo, a la derecha) — mismo layout que Bandejas (`domain/bandejas.md`), pero sin acción de apertura: un reporte se mira y se exporta, no dispara nada sobre un legajo/trámite.

Reusa el mecanismo de query-filtros y la tabla `FILTROS` de Bandejas — ver ADR 0014 para la comparación y el porqué de no reusar la tabla `BANDEJAS` en sí.

## Tablas

### REPORTES_CATEGORIAS

| Campo  | Tipo             |
| ------ | ---------------- |
| ID     | UUID, PK         |
| CODIGO | string, unique   |
| NOMBRE | string           |

Categorías estándar (seedeadas en `seed-config.ts`): `auditoria` ("Auditoría"), `utilidades` ("Utilidades"), `general` ("General") — administrables como cualquier catálogo simple, sin ABM propio todavía (se agregan por seed si hace falta una nueva).

### REPORTES

| Campo        | Tipo                                                              |
| ------------ | -------------------------------------------------------------------- |
| ID           | UUID, PK                                                              |
| CODIGO       | string, unique                                                        |
| NOMBRE       | string                                                                |
| DESCRIPCION  | string, nullable                                                      |
| ID_CATEGORIA | FK → REPORTES_CATEGORIAS, **not null**                                |
| QUERY        | text — SQL base del reporte, con alias explícitos (mismo formato que `BANDEJAS.QUERY`) |
| COLUMNAS     | jsonb — columnas visibles del listado: `[{campo, label, tipo, orden}]` |

`QUERY` se carga por código/migración (autoría de developer, mismo nivel de confianza que `ACCIONES.COMANDO`/`BANDEJAS.QUERY` — ver ADR 0009 y ADR 0014), pero a diferencia de `BANDEJAS.QUERY`, sí es editable desde el ABM de Reportes (`/dashboard/reportes-admin`) — no hay pantalla de SQL libre para el USUARIO final, pero un admin con acceso a esa herramienta puede tocar `QUERY`/`COLUMNAS`/`ID_CATEGORIA` directamente.

**Orden por defecto**: todo `REPORTES.QUERY` termina con `ORDER BY <columna de fecha principal> DESC` — el motor de paginación (`query-filtros.ts`) no agrega ningún `ORDER BY` propio, así que sin uno en la query de base el orden entre páginas queda indefinido. El click-to-sort del listado (`ReporteResultados`) solo reordena la página actual, no sirve como sustituto de esto.

### REPORTES_FILTROS

| Campo       | Tipo                                                    |
| ----------- | ---------------------------------------------------------- |
| ID          | UUID, PK                                                    |
| ID_REPORTE  | FK → REPORTES                                               |
| ID_FILTRO   | FK → FILTROS                                                |
| CAMPO       | string — alias de REPORTES.QUERY al que aplica              |
| ORDEN       | integer — posición en el formulario                         |

Mismo patrón que `BANDEJAS_FILTROS`: sin constraint de unicidad, tabla ordenada. Se administra vía ABM (ver más abajo), no por seed — vincular un `FILTRO` existente a un reporte es configuración de negocio, no requiere deploy.

### REPORTES_PERFILES

| Campo      | Tipo             |
| ---------- | ---------------- |
| ID         | UUID, PK          |
| ID_REPORTE | FK → REPORTES     |
| ID_PERFIL  | FK → PERFILES     |

Unique constraint sobre (`ID_REPORTE`, `ID_PERFIL`) — mismo patrón que `BANDEJAS_PERFILES`. Controla qué reportes ve cada perfil dentro de la herramienta, más fino que el permiso a nivel de la `HERRAMIENTA` "Reportes".

## Mecanismo de dinamismo

Idéntico al de Bandejas (`domain/bandejas.md`, sección "Mecanismo de dinamismo"), reusando la misma función compartida:

- `REPORTES.QUERY` se envuelve en ejecución: `SELECT * FROM (<REPORTES.QUERY>) AS r WHERE <condiciones> LIMIT <n> OFFSET <m>` — condiciones armadas contra los alias de salida, igual que Bandejas.
- `REPORTES.COLUMNAS` decide qué alias se muestran, en qué orden y con qué label — mismo formato que `BANDEJAS.COLUMNAS`.
- `REPORTES_FILTROS.CAMPO` conecta un `FILTRO` reutilizable a un alias puntual de un reporte puntual.

**Diferencia con Bandejas — paginación**: la función compartida acepta `limit`/`offset` opcionales. Bandejas no los pasa (mantiene su comportamiento actual, sin paginar). Reportes los pasa siempre, porque el volumen esperado de un reporte de análisis es mayor al de una bandeja de trabajo.

## Export CSV / TSV

Dos botones en la vista del reporte, sobre el listado. El export:

- Re-ejecuta la misma query con los mismos filtros aplicados, pero **sin** `limit`/`offset` — trae el resultado completo filtrado, no solo la página visible en pantalla. Paginar el export contradice su propósito de análisis.
- Arma el archivo con el orden y los `label` de `REPORTES.COLUMNAS` como cabecera.
- Separador `,` para CSV, `\t` para TSV; escaping estándar (comillas si el valor contiene el separador, comillas o salto de línea).
- Gatea con el mismo permiso (`REPORTES_PERFILES`) que el listado.

Pendiente evaluar a futuro si algún reporte de volumen muy alto necesita streaming en vez de armar el archivo completo en memoria — no bloqueante para la primera versión.

## Seguridad — parametrización obligatoria

Mismo criterio que Bandejas (ADR 0009, ADR 0014): `REPORTES.QUERY` es contenido de confianza (autorado por un developer), pero los valores que tipea el usuario en el formulario de filtros siempre se pasan parametrizados — nunca interpolación de string.

## Herramientas de administración

- **`/dashboard/reportes`** (`HERRAMIENTAS.CODIGO = 'reportes'`): la herramienta de búsqueda — elegir reporte, aplicar filtros, ver listado paginado, exportar. `ReportesTool` reusa `BandejaFiltros` tal cual (el formulario de filtros es idéntico en forma a Bandejas — mismo `FiltroBandeja`/`FiltroReporte` estructural) y agrega `ReporteResultados` (paginación + export, sin columna "Acciones" porque no hay apertura). El listado de la izquierda (`ReportesPanel`) agrupa los reportes por `REPORTES_CATEGORIAS.NOMBRE` (los sin categoría, imposible hoy por el `NOT NULL`, caerían en "Sin categoría") — `listReportesParaPerfil` ya devuelve las filas ordenadas por categoría primero.
- **`/dashboard/reportes-admin`** (`HERRAMIENTAS.CODIGO = 'reportes_admin'`, distinto de `'reportes'`, mismo criterio que `bandejas_admin`/`bandejas`): ABM de los vínculos — qué `FILTROS` tiene cada reporte (`REPORTES_FILTROS`, con `CAMPO`/`ORDEN`) y qué `PERFILES` lo ven (`REPORTES_PERFILES`, checklist). `REPORTES.QUERY`/`COLUMNAS` no se editan desde acá — se cargan por migración/seed.

## Implementación

- **`packages/core/src/query-filtros.ts`**: motor compartido extraído de `bandejas.ts` (armado de `WHERE` + bind seguro, `ejecutarQueryConFiltros(queryBase, filtrosRows, valores, {limit?, offset?})`). `bandejas.ts` lo reusa sin cambiar su comportamiento (sigue sin paginar); `reportes.ts` siempre pasa `limit`/`offset`.
- **`packages/core/src/reportes.ts`**: ejecución — `listReportesParaPerfil`, `getReporteConfig`, `buscarReporte` (pagina 0-based, trae `PAGE_SIZE + 1` filas para saber si hay página siguiente sin un `COUNT(*)` aparte — `PAGE_SIZE = 50`), `exportarReporte` (sin límite, arma CSV/TSV con escaping estándar).
- **`packages/core/src/reportes-admin.ts`**: ABM — CRUD de `REPORTES`/`REPORTES_FILTROS`/`REPORTES_PERFILES`, calcado 1:1 de `bandejas-admin.ts`.
- **Export vía API route, no server action**: `GET /api/reportes/[id]/export` — una server action no puede devolver un archivo con `Content-Disposition`. Verifica acceso contra `REPORTES_PERFILES` (vía `listReportesParaPerfil`) antes de exportar. Los filtros viajan como query params; solo se aplican los que `REPORTES_FILTROS` tiene configurados para ese reporte, así que parámetros extra no hacen nada. El contenido lleva un BOM UTF-8 al inicio (Excel en Windows mal-interpreta acentos sin él).
- **`apps/web/src/lib/resultados-formato.tsx`**: `formatearValor`/`compararValores` compartidos entre `BandejaResultados` y `ReporteResultados` (mismo vocabulario de `tipo` de columna: `badge`/`fecha`/default).
- **Primer reporte real, seedeado en `seed-config.ts`**: `auditoria_generaciones_documento` ("Auditoría de Generación de Documentos") sobre `GENERACIONES_DOCUMENTO`, con filtros Estado/Plantilla/Fecha de Alta (este último reusa el `FILTRO` genérico `fecha_alta` ya seedeado para Legajos).

Ver ADR 0014 para el razonamiento completo de las decisiones de diseño.
