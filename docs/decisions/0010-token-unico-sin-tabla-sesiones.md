# 0010 - Token de sesión único en USUARIOS, sin tabla SESIONES

## Estado

Aceptada

## Contexto

Se necesita un mecanismo simple de sesión para autenticar operaciones en el sistema (ver ADR 0006).

## Decisión

El token de sesión se guarda directo en `USUARIOS` (`TOKEN`, `TOKEN_EXPIRACION`), sin una tabla `SESIONES` separada.

## Alternativas consideradas

- **Tabla SESIONES independiente**: permitiría múltiples sesiones simultáneas por usuario (ej. celular + computadora sin desloguearse), a cambio de más complejidad de la que se justifica para la demo actual.

## Consecuencias

- Un usuario solo puede tener una sesión activa a la vez — loguearse en un segundo dispositivo invalida la sesión del primero.
- Si en el futuro se necesita soporte de sesiones múltiples, esta decisión debe revisarse y reemplazarse por una ADR nueva que introduzca `SESIONES`.
