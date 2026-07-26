# 0008 - UUID como clave primaria en todas las tablas

## Estado

Aceptada

## Contexto

El sistema usa un patrón de asociación polimórfica (`ID_ENTIDAD` + `ID_RELACION`, ver `domain/core.md`) para funcionalidad transversal (historial, y a futuro mensajería), que necesita que el tipo de dato del identificador sea consistente entre todas las tablas a las que puede apuntar — dado que no hay un FK real de base de datos que lo garantice.

## Decisión

Todas las tablas del sistema usan UUID como tipo de dato de su clave primaria ID.

## Alternativas consideradas

- **Autoincremental (integer/serial)**: más liviano y con mejor performance de índice, pero rompe la consistencia de tipo necesaria para el patrón de asociación polimórfica, y expone secuencialmente la cantidad de registros de cada tabla.

## Consecuencias

- El patrón `ID_ENTIDAD`/`ID_RELACION` funciona sin fricción de casting entre tipos.
- Índices levemente más pesados que con enteros autoincrementales — no relevante a la escala actual del proyecto.
