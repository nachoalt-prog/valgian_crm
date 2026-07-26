# Visión del producto

## Qué es

Un CRM genérico y modular, con capacidad de adaptarse a distintos tipos de negocio sin reescribir el producto para cada cliente. Tiene un núcleo (legajos, clientes, cuentas, permisos) sobre el que se enchufan módulos según lo que cada negocio necesite — pipeline de ventas, mensajería, facturación, etc. Ver `contracts/modulo.md` para el contrato que debe cumplir cada módulo.

La base de conocimiento del dominio proviene de la experiencia previa en ADV — el objetivo es tomar ese conocimiento del negocio y construir una versión moderna, modular y reutilizable, sin las limitaciones técnicas del sistema anterior.

## Para quién

Negocios que necesitan un CRM a medida sin pagar el costo de un desarrollo 100% custom desde cero. El core resuelve lo común a cualquier negocio; los módulos resuelven lo específico de cada rubro.

## Modelo de distribución

Una instancia por cliente (self-hosted o cloud separado) — no un SaaS multi-tenant compartido. Ver ADR 0001.

## Cómo se construye

Un desarrollador único cumple el rol de arquitecto y diseñador del producto: define el modelo de datos, las reglas de negocio, la arquitectura de módulos y los criterios de calidad. La implementación técnica está fuertemente asistida por IA (Claude Code), que ejecuta a partir de esta documentación. Es un proyecto part-time, con foco en llegar a una demo mostrable antes que a un producto de producción completo.

## Alcance de la etapa actual

No es un producto de producción listo para clientes reales. Es una demo funcional y presentable: núcleo del CRM + al menos dos módulos, multiusuario, con datos de ejemplo cargados, desplegada y accesible por link. Sirve para validar el producto con clientes potenciales y con otros integrantes de la startup. Ver `project/roadmap_crm.md` para el detalle de etapas y plazos.
