# 0006 - Autenticación propia, sin servicio externo hosteado

## Estado

Aceptada

## Contexto

Con el modelo de instancia-por-cliente (ADR 0001), depender de un servicio de autenticación externo agregaría una dependencia y un punto de falla externo a cada deploy individual.

## Decisión

Autenticación resuelta dentro de la propia instancia: hash de contraseña (Argon2id) y manejo de sesión propios, sin servicio externo.

## Alternativas consideradas

- **Clerk, Auth0 (u otro servicio externo hosteado)**: descartados por la razón de contexto — no son coherentes con el modelo de instancias autocontenidas.

## Consecuencias

- Cada instancia es autosuficiente en cuanto a autenticación.
- Se asume el trabajo de implementar y mantener la lógica de auth propia, en vez de delegarla.
- Si el producto migra en el futuro hacia un modelo SaaS multi-tenant centralizado, esta decisión debería reconsiderarse.
- El manejo de sesión concreto (token único vs. tabla de sesiones) se resuelve en ADR 0010.
