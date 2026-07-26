# 0005 - Turborepo + pnpm como monorepo

## Estado

Aceptada

## Contexto

La modularidad del producto se refleja en la estructura de código: el core y cada módulo viven como paquetes separados dentro del mismo repositorio, con dependencias explícitas entre sí.

## Decisión

Turborepo como orquestador de monorepo, pnpm como package manager.

## Alternativas consideradas

- **Nx**: más potente, pero con más complejidad de configuración de la que el proyecto necesita hoy.
- **npm/yarn clásico**: manejan peor las dependencias compartidas entre paquetes de un monorepo que pnpm.

## Consecuencias

- Cada módulo puede desarrollarse y versionarse como paquete independiente dentro del repo.
- Instalaciones más rápidas y menos duplicación de dependencias con pnpm.
