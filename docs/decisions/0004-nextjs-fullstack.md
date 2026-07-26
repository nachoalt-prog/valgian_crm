# 0004 - Next.js como frontend y capa de API, sin backend separado

## Estado

Aceptada

## Contexto

Con el modelo de instancia-por-cliente y escala nicho (no miles de usuarios concurrentes), no hay necesidad clara de separar frontend y backend en servicios distintos. El proyecto es desarrollado part-time por un equipo chico, donde reducir superficie de mantenimiento es valioso.

## Decisión

Next.js (App Router) cubre tanto el frontend como la capa de API, vía server actions y route handlers.

## Alternativas consideradas

- **Backend separado (NestJS, Express) con frontend independiente**: descartado por agregar complejidad operativa (dos deploys o un monorepo más pesado) sin beneficio claro a esta escala.

## Consecuencias

- Un solo framework, un solo deploy por instancia.
- Si en el futuro el producto necesita exponer una API pública para integraciones externas, hay que evaluar si sigue alcanzando con route handlers o se justifica separar esa capa.
