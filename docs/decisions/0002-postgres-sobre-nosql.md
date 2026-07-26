# 0002 - PostgreSQL sobre NoSQL

## Estado

Aceptada

## Contexto

Había que elegir la base de datos principal del sistema. El dominio de un CRM es fuertemente relacional (legajos, clientes, cuentas, productos, con relaciones claras entre sí), pero el producto necesita permitir campos personalizados por cliente sin migraciones de schema por cada uno.

## Decisión

PostgreSQL como base de datos relacional principal, usando JSONB donde se necesite flexibilidad de campos por cliente.

## Alternativas consideradas

- **MongoDB / NoSQL**: descartado como base principal — complica las relaciones y los reportes, que son el uso diario de un CRM. Podría considerarse a futuro como complemento puntual (logs, eventos), no como core.
- **MySQL**: viable, pero Postgres tiene mejor soporte de JSONB y de tipos de datos avanzados, con mejor soporte en el ecosistema TypeScript/Next.js actual.

## Consecuencias

- El core se modela con schema rígido y normalizado; la extensibilidad por cliente se resuelve con JSONB en campos puntuales, no con cambios de schema.
- Buen soporte con el ORM elegido (ver ADR 0003).
