# 0003 - Drizzle sobre Prisma

## Estado

Aceptada

## Contexto

Con el modelo de instancia-por-cliente (ADR 0001), las migraciones se aplican de forma repetida contra bases separadas e independientes. Además, gran parte del código se genera con asistencia de IA a partir de un schema bien definido, lo que favorece herramientas con menos capas de abstracción.

## Decisión

Drizzle como ORM y herramienta de migraciones.

## Alternativas consideradas

- **Prisma**: más completo out-of-the-box, pero con una capa de abstracción más pesada y migraciones menos transparentes.

## Consecuencias

- Control explícito sobre el SQL generado, lo que reduce el riesgo de sorpresas al replicar una migración entre instancias.
- Parte de la lógica del sistema (motor de estados) vive directamente en PL/pgSQL fuera de Drizzle — ver ADR 0009. Requiere una estrategia de migraciones SQL manuales en paralelo a las de Drizzle.
