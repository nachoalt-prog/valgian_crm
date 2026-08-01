# 0014 - El motor de Reportes reusa el mecanismo de query-filtros de Bandejas

## Estado

Aceptada — implementada (ver `domain/reportes.md`).

## Contexto

Se necesita un módulo de Reportes: se elige un reporte (a la izquierda), y a la derecha se despliegan sus filtros (arriba) y su listado de columnas/registros (abajo) — mismo layout conceptual que Bandejas (ver `domain/bandejas.md`), pero para listados de análisis en vez de worklists accionables (Bandejas abre un legajo/trámite al hacer click en una fila; un reporte solo se mira/exporta).

Existían dos mecanismos ya construidos en el proyecto que podían resolver "aplicar filtros dinámicos a una query configurada":

1. **El motor de Bandejas** (`packages/core/src/bandejas.ts`): `BANDEJAS.QUERY` es un `SELECT` con alias, ejecutado envuelto como `SELECT * FROM (<query>) AS b WHERE <condiciones>`, con las condiciones armadas contra los alias de salida. Los nombres de columna que se interpolan se validan con regex estricta; los valores que tipea el usuario siempre van parametrizados con bind real. Soporta cuatro tipos de filtro (`texto_like`, `select`, `fecha`, `fecha_rango`) vía la tabla `FILTROS`, ya genérica y desacoplada de `BANDEJAS`.
2. **El motor de Placeholders** (`packages/core/src/placeholders.ts`): sustituye un único valor escalar (`##CODIGO##`) dentro de un texto HTML, ejecutando una query aislada de una sola fila/columna por placeholder. No tiene noción de rangos, `ILIKE`, `IN`, ni de componer múltiples condiciones `WHERE` — está diseñado para narrativa de documentos, no para búsquedas tabulares.

## Decisión

Reusar el **motor de Bandejas**, no el de Placeholders. Se extrae la lógica de armado de `WHERE` + bind seguro de valores de `bandejas.ts` a una función compartida en `packages/core` (usada tanto por Bandejas como por el nuevo módulo de Reportes), y se reusa la tabla `FILTROS` tal cual.

No se reusa la tabla `BANDEJAS` en sí — se crean tablas nuevas y separadas (`REPORTES`, `REPORTES_FILTROS`, `REPORTES_PERFILES`, ver `domain/reportes.md`), porque un reporte es conceptualmente distinto de una bandeja (sin apertura de legajo/trámite) y mezclar ambos conceptos en la misma tabla obligaría a arrastrar semántica de "apertura" que un reporte no necesita.

Decisiones puntuales que completan el diseño:

- **Autoría de la query**: `REPORTES.QUERY` se define en código/migración por un developer, igual nivel de confianza que `ACCIONES.COMANDO`/`BANDEJAS.QUERY` (ADR 0009) — no hay pantalla de SQL libre para admin.
- **Vínculos administrables**: `REPORTES_FILTROS` (qué filtros tiene un reporte, en qué orden) y `REPORTES_PERFILES` (qué perfiles lo ven) sí tienen ABM propio, calcado de `/dashboard/bandejas-admin` — el mismo criterio que ya separa "la query es de confianza del dev" de "los vínculos son configuración de negocio editable por un admin funcional".
- **Permisos por reporte individual**: `REPORTES_PERFILES`, mismo patrón que `BANDEJAS_PERFILES` — más fino que el permiso a nivel de la herramienta "Reportes".
- **Paginación desde el día 1**: la función compartida acepta `limit`/`offset` opcionales. Bandejas sigue sin pasarlos (cero cambio de comportamiento); Reportes siempre los pasa, porque el volumen esperado de un reporte es mayor al de una bandeja de trabajo.
- **Export CSV/TSV**: dos botones en la vista del reporte. El export re-ejecuta la misma query con los mismos filtros pero **sin** `limit`/`offset` — trae el resultado completo filtrado, no solo la página visible, porque paginar el export contradice su propósito de análisis.

## Alternativas consideradas

- **Reusar el motor de Placeholders** (`##TAG##`): descartado — fue diseñado para sustitución de un valor escalar en texto, no para componer un `WHERE` dinámico con operadores tipados (rango, `ILIKE`, igualdad). Forzarlo a este caso significaría reinventar a mano, y peor, lo que Bandejas ya resuelve.
- **Reusar la tabla `BANDEJAS` directamente** (agregando un `TIPO_APERTURA` nulo/`'ninguno'` para representar "solo reporte, sin acción"): descartado — mezclaría dos conceptos de producto distintos (worklist accionable vs. listado de análisis) bajo la misma tabla y el mismo ABM, reduciendo claridad a cambio de ahorrar dos tablas.
- **Query builder visual en vez de SQL escrito por el dev**: descartado por ahora — sobre-ingeniería para el alcance actual; el patrón de "SQL de confianza autorado por quien tiene acceso al ABM" ya es aceptado en el proyecto (ADR 0009) y se reusa tal cual.
- **Export solo de la página visible en pantalla** (sin re-query): descartado — con paginación server-side, exportar solo la página actual haría el botón de export inútil para reportes con volumen real.
- **Sin ABM para `REPORTES_FILTROS`/`REPORTES_PERFILES`** (todo por seed): descartado — ajustar qué filtros tiene un reporte o qué perfiles lo ven es una tarea de configuración de negocio recurrente, no debería requerir un deploy cada vez (mismo criterio que ya separa infraestructura de negocio en ADR 0013).

## Consecuencias

- `bandejas.ts` se refactoriza para extraer la función de armado de `WHERE`+bind a un módulo compartido, sin cambiar su comportamiento actual (Bandejas sigue sin paginar).
- Nueva migración Drizzle para `REPORTES`, `REPORTES_FILTROS`, `REPORTES_PERFILES`.
- Nueva herramienta de búsqueda (`/dashboard/reportes`, calcada de `bandejas-tool.tsx`) y nueva herramienta de administración (`/dashboard/reportes-admin`, calcada de `bandejas-admin-panel.tsx`).
- El vocabulario de tipos de columna del listado (hoy `fecha`/`badge`/string, en `apps/web/src/lib/resultados-formato.tsx` — compartido entre Bandejas y Reportes) probablemente necesite ampliarse (`moneda`, `numero`) a medida que se carguen reportes reales — no se definió de antemano, se agrega cuando haga falta.
