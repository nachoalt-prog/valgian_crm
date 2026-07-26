# 0001 - Instancia separada por cliente

## Estado

Aceptada

## Contexto

Había que definir cómo se distribuye el CRM entre distintos negocios/clientes: un SaaS multi-tenant compartido (una instancia, muchos clientes) o una instancia separada por cliente. El proyecto es de escala nicho (pocos negocios, uso interno) y desarrollado por un equipo chico.

## Decisión

Cada cliente tiene su propia instancia (self-hosted o cloud separado), no una base compartida.

## Alternativas consideradas

- **SaaS multi-tenant**: descartado por ahora — requiere resolver aislamiento de datos entre clientes (tenant_id en cada tabla, riesgo de fuga de datos), complejidad que no se justifica a la escala actual.

## Consecuencias

- No hace falta diseñar aislamiento multi-tenant a nivel de datos.
- Cada cliente puede escalar de forma independiente.
- Costo operativo: cada actualización del producto debe poder desplegarse en N instancias separadas — requiere migraciones versionadas y proceso de deploy reproducible, no scripts manuales.
- La autenticación y otras dependencias externas deben poder resolverse dentro de cada instancia de forma autocontenida (ver ADR 0006).
