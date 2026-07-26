# 0009 - Lógica del motor de estados en Stored Procedures (PL/pgSQL)

## Estado

Aceptada

## Contexto

El motor de estados (ver `domain/motor-de-estados.md`) necesita ejecutar, ante cada transición: actualización de estado, registro de historial, y una secuencia ordenada de acciones configurables por estrategia. Guardar el código de cada acción como un identificador que la aplicación interpreta limita la flexibilidad de qué puede hacer una acción; guardar código ejecutable real la maximiza, a cambio de mover parte de la lógica de negocio fuera de la capa de aplicación.

## Decisión

`ACCIONES.COMANDO` contiene código SQL ejecutable real, corrido por un Stored Procedure que orquesta el flujo completo de la transición (buscar transición válida → confirmar estado + historial → ejecutar acciones en orden).

## Alternativas consideradas

- **Identificador interpretado por la aplicación** (ej. un slug que el código de Next.js mapea a una función predefinida): más simple y sin riesgo de seguridad de ejecutar código dinámico, pero menos flexible — cada acción nueva requeriría un deploy de código en vez de una simple configuración de datos.
- **Código ejecutable arbitrario en cualquier lenguaje**: descartado — ejecutar código guardado en base de datos sin restricción de lenguaje/alcance es un riesgo de seguridad mayor al que se acepta con SQL dentro de un SP.

## Consecuencias

- Las estrategias completas (transiciones + acciones) viven como lógica de base de datos, no en la capa de aplicación.
- Los SPs y el código de `COMANDO` requieren su propia estrategia de versionado (migraciones SQL manuales), separada de las migraciones que Drizzle genera automáticamente a partir del schema TypeScript (ver ADR 0003).
- El cambio de estado y el registro de historial se confirman de forma atómica antes de ejecutar las acciones; un fallo en una acción no revierte lo ya confirmado — queda registrado en el propio `HISTORIAL` (`ACCIONES_STATUS`/`ACCIONES_ERROR`).
