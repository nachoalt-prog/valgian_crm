# Manual: soporte — corregir un dato puntual de un cliente

Este documento es distinto de `docs/runbooks/actualizaciones.md`. Ese otro manual es para releases de código (cambios que se compilan y se deployan). Este es para cuando el problema no es el código, sino un dato mal cargado en la base de UN cliente puntual.

## Cuándo usar este documento vs. el de actualizaciones

- Si el problema es que el código hace algo mal para **cualquiera** que use esa parte del sistema (un módulo, una pantalla, una regla) → no es este documento, es un bug → ver `docs/runbooks/actualizaciones.md`.
- Si el problema es que **un dato específico de un cliente** está mal cargado (ej. un `PERMISO` que le falta a un usuario, una fila de `MENUES_OPCIONES` mal configurada, un rol asignado incorrecto) → es este documento.

## Regla de oro

Nunca se toca código. Nunca se toca la base de datos de otro cliente. Se opera exclusivamente sobre la instancia del cliente afectado.

## Paso a paso

1. Confirmar con precisión qué registro está mal: qué tabla, qué fila, qué valor tiene hoy y cuál debería tener.
2. Preferir siempre la pantalla de administración correspondiente dentro del propio sistema (ej. las pantallas de permisos que ya existen en `apps/web/src/components`), entrando como usuario admin a la instancia de ESE cliente. Es preferible a tocar la base directamente porque queda auditado por el propio sistema — quién lo hizo y cuándo.
3. Si no existe una pantalla para ese caso puntual: escribir el `UPDATE`/`INSERT` mínimo necesario como un script (`.sql` o `.ts`) — no lo tipees suelto en una consola y lo tires después.
4. Correrlo contra la base de datos de ESE cliente (nunca la local de desarrollo, nunca la de otro cliente), y **commitear ese mismo script de forma permanente** (no se borra) bajo `docs/runbooks/soporte-parches/<client-slug>/<fecha>-<descripcion>.sql` — ese archivo ES el registro de qué se tocó, cuándo y por qué (el "por qué" va como comentario arriba del `UPDATE`). Ver ADR 0020. Es distinto del mecanismo de "parches de datos estándar" (`packages/db/parches/`) — este parche es de UN cliente puntual, nunca se reejecuta en otra base ni queda trackeado en `_PARCHES_APLICADOS`.
5. Si el mismo tipo de ajuste se repite para varios clientes, es una señal de que falta una pantalla o una regla de negocio en el core o en un módulo. En ese caso, dejar de resolverlo a mano y convertirlo en una mejora de código real, siguiendo `docs/runbooks/actualizaciones.md`.

## Nota de seguridad

Nunca ejecutar un `UPDATE` o `INSERT` manual sin antes correr un `SELECT` de verificación sobre la fila exacta que se va a tocar. Verificar dos veces a qué base de datos (a qué cliente) está conectada la sesión antes de escribir — escribir contra la base equivocada es exactamente el tipo de error que este documento existe para evitar.
