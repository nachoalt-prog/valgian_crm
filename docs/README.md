# Documentación — CRM Modular

Este repositorio de documentación es la fuente de verdad técnica del proyecto. Se mantiene actualizado a medida que el sistema evoluciona — no es un registro histórico de cómo se llegó a las decisiones, sino una descripción de cómo es el sistema hoy.

## Cómo está organizada

- **`architecture/`** — visión del producto y stack tecnológico. Referencia viva: describe el estado actual, se edita in-place cuando cambia.
- **`domain/`** — modelo de datos, organizado en un documento atómico por subsistema (core, motor de estados, infraestructura, bandejas, layouts de legajo). Misma lógica: referencia viva, se edita in-place.
- **`contracts/`** — contratos que debe cumplir cualquier pieza extensible del sistema (por ejemplo, qué debe cumplir un módulo para engancharse al core).
- **`decisions/`** — Architecture Decision Records (ADR). El por qué de cada decisión importante, con sus alternativas descartadas. A diferencia de todo lo anterior, no se edita: si una decisión cambia, se agrega una ADR nueva que reemplaza a la anterior, y la vieja queda intacta como registro histórico.
- **`open-issues.md`** — todo lo que está pendiente de resolver en el sistema, sin importar de qué subsistema se trate. Cuando algo se resuelve, sale de acá y su resolución pasa a vivir en `architecture/`, `domain/` o como una nueva ADR, según corresponda.
- **`desarrollo-local.md`** — guía práctica de comandos para levantar el ambiente de desarrollo (Docker, migraciones, seed, troubleshooting). Referencia viva, se edita in-place.
- **`runbooks/`** — manuales paso a paso para operaciones concretas (instalar un cliente nuevo, actualizar el core/un módulo, corregir un dato puntual en soporte). A diferencia de `desarrollo-local.md` (ambiente de desarrollo compartido), estos son procedimientos sobre instancias reales de cliente.
- **`project/`** — gestión de proyecto (roadmap, planificación) y catálogos operativos que no son modelo de datos (ej. `catalogo-recursos-estandar.md`). No es documentación técnica del sistema en sí en el sentido de `domain/`.

## Regla general

Si estás por escribir código y algo no está definido en esta documentación, se pregunta antes de asumir un criterio — no se inventa sobre la marcha.
